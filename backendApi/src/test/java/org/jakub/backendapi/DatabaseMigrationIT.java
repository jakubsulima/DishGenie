package org.jakub.backendapi;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.jakub.backendapi.services.RateLimitService;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.concurrent.CompletableFuture;
import java.util.stream.IntStream;
import java.util.UUID;

@Testcontainers
@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.jpa.properties.hibernate.type.preferred_instant_jdbc_type=TIMESTAMP",
        "oauth.google.client-id=test-client-id",
        "posthog.enabled=false"
})
class DatabaseMigrationIT {

    private static final String TEST_JWT_SECRET = UUID.randomUUID().toString() + UUID.randomUUID();

    @DynamicPropertySource
    static void registerTestProperties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.token.secret-key", () -> TEST_JWT_SECRET);
    }

    @Container
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:17-alpine").withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", POSTGRES::getDriverClassName);
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private RateLimitService rateLimitService;

    @Test
    void adminOnlyMigrationDisablesThePreviouslyPublicRolloutAndChangesItsVersion() {
        jdbcTemplate.update("UPDATE offer_feature_setting SET enabled_for_users=TRUE, version=10, updated_by='admin@example.test' WHERE id=1");
        var migration = new org.springframework.jdbc.datasource.init.ResourceDatabasePopulator(
                new org.springframework.core.io.ClassPathResource("db/migration/V34__Default_offers_to_admin_only.sql"));
        migration.execute(java.util.Objects.requireNonNull(jdbcTemplate.getDataSource()));
        assertThat(jdbcTemplate.queryForObject("SELECT enabled_for_users FROM offer_feature_setting WHERE id=1", Boolean.class)).isFalse();
        assertThat(jdbcTemplate.queryForObject("SELECT version FROM offer_feature_setting WHERE id=1", Long.class)).isEqualTo(11L);
        assertThat(jdbcTemplate.queryForObject("SELECT updated_by FROM offer_feature_setting WHERE id=1", String.class)).isNull();
    }

    @Test
    void allFlywayMigrationsMatchThePostgresEntityModel() {
        assertThat(jdbcTemplate.queryForObject("SELECT enabled_for_users FROM offer_feature_setting WHERE id=1", Boolean.class)).isFalse();
        Integer resetColumns = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.columns " +
                        "WHERE table_name = 'app_user' " +
                        "AND column_name IN ('password_reset_token_hash', 'password_reset_expires_at')",
                Integer.class
        );
        Integer rateLimitTables = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_name = 'rate_limit_bucket'",
                Integer.class
        );

        assertThat(resetColumns).isEqualTo(2);
        assertThat(rateLimitTables).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_name IN ('cycle_request','shopping_trip','prepared_portion_transfer')", Integer.class)).isEqualTo(3);
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM pg_indexes WHERE indexname = 'shopping_trip_one_open'", Integer.class)).isEqualTo(1);

        Integer recipePrivacyColumns = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.columns " +
                        "WHERE table_name = 'recipe' " +
                        "AND column_name IN ('visibility', 'servings')",
                Integer.class
        );
        assertThat(recipePrivacyColumns).isEqualTo(2);

        Integer privacyConstraint = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM pg_constraint " +
                        "WHERE conname = 'recipe_visibility_check'",
                Integer.class
        );
        assertThat(privacyConstraint).isEqualTo(1);

        Integer canonicalIngredientColumns = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.columns " +
                        "WHERE table_name = 'ingredient' " +
                        "AND column_name IN ('canonical_name', 'is_staple')",
                Integer.class
        );
        assertThat(canonicalIngredientColumns).isEqualTo(2);
        Integer aliasTable = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_name = 'ingredient_alias'",
                Integer.class
        );
        assertThat(aliasTable).isEqualTo(1);
        Integer localeConstraints = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM pg_constraint " +
                        "WHERE conname IN ('ingredient_alias_locale_check', 'recipe_content_locale_check')",
                Integer.class
        );
        assertThat(localeConstraints).isEqualTo(2);
        String recipeLocaleDefault = jdbcTemplate.queryForObject(
                "SELECT column_default FROM information_schema.columns " +
                        "WHERE table_name = 'recipe' AND column_name = 'content_locale'",
                String.class
        );
        assertThat(recipeLocaleDefault).contains("en");
    }

    @Test
    void additiveOperationSnapshotMigrationKeepsLegacyRowsReadable() {
        long userId = 901L;
        long operationId = 902L;
        jdbcTemplate.update(
                "INSERT INTO app_user (id, email, password, role, auth_method, subscription_plan, daily_recipe_count) " +
                        "VALUES (?, ?, ?, 'USER', 'CREDENTIALS', 'FREE', 0)",
                userId, "migration-existing-" + UUID.randomUUID() + "@example.com", "hash"
        );
        jdbcTemplate.update(
                "INSERT INTO fridge_inventory_operation " +
                        "(id, user_id, client_operation_id, source, status, result_json) " +
                        "VALUES (?, ?, ?, 'QUICK_ADJUSTMENT', 'APPLIED', ?)",
                operationId, userId, UUID.randomUUID().toString(), "{}"
        );
        jdbcTemplate.update(
                "INSERT INTO fridge_inventory_operation_change " +
                        "(operation_id, change_type, before_exists, before_name, before_amount, after_exists, after_name, after_amount) " +
                        "VALUES (?, 'DECREMENT', true, 'Milk', 2, true, 'Milk', 1)",
                operationId
        );

        Integer snapshotColumns = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.columns " +
                        "WHERE table_name = 'fridge_inventory_operation_change' " +
                        "AND column_name IN ('before_source', 'after_source', " +
                        "'before_quantity_accuracy', 'after_quantity_accuracy', 'before_barcode', 'after_barcode', " +
                        "'before_last_confirmed_at', 'after_last_confirmed_at', 'before_ingredient_id', 'after_ingredient_id')",
                Integer.class
        );
        assertThat(snapshotColumns).isEqualTo(10);

        Integer legacyNullMetadata = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM fridge_inventory_operation_change " +
                        "WHERE operation_id = ? AND before_source IS NULL AND after_source IS NULL " +
                        "AND before_quantity_accuracy IS NULL AND after_quantity_accuracy IS NULL " +
                        "AND before_barcode IS NULL AND after_barcode IS NULL " +
                        "AND before_last_confirmed_at IS NULL AND after_last_confirmed_at IS NULL " +
                        "AND before_ingredient_id IS NULL AND after_ingredient_id IS NULL",
                Integer.class,
                operationId
        );
        assertThat(legacyNullMetadata).isEqualTo(1);
    }

    @Test
    void sharedRateLimitRemainsAtomicAcrossConcurrentTransactions() {
        String bucketKey = "integration-concurrent-bucket";
        var attempts = IntStream.range(0, 8)
                .mapToObj(index -> CompletableFuture.supplyAsync(() -> {
                    try {
                        rateLimitService.assertAllowed(bucketKey, 3, 60_000, "limited");
                        return true;
                    } catch (RuntimeException exception) {
                        return false;
                    }
                }))
                .toList();

        long allowed = attempts.stream()
                .map(CompletableFuture::join)
                .filter(Boolean::booleanValue)
                .count();

        assertThat(allowed).isEqualTo(3);
        assertThat(rateLimitService.getCurrentRequestCount(bucketKey, 60_000)).isEqualTo(3);
    }
    @Test
    void appliedV31RemainsImmutableAndDiscardedPortionsArriveAdditively() {
        assertThat(jdbcTemplate.queryForObject("SELECT checksum FROM flyway_schema_history WHERE version = '31'", Integer.class))
                .isEqualTo(1291847981);
        String schema="upgrade_v31_"+UUID.randomUUID().toString().replace("-", "");
        var before=org.flywaydb.core.Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword())
                .schemas(schema).defaultSchema(schema).target("31").load();
        try {
            before.migrate();
            var dataSource=new org.springframework.jdbc.datasource.DriverManagerDataSource(POSTGRES.getJdbcUrl()+"&currentSchema="+schema,POSTGRES.getUsername(),POSTGRES.getPassword());
            var legacy=new JdbcTemplate(dataSource);
            assertThat(legacy.queryForObject("SELECT count(*) FROM information_schema.columns WHERE table_schema=? AND table_name='prepared_portion_transfer' AND column_name='discarded'",Integer.class,schema)).isZero();
            legacy.update("INSERT INTO app_user (id,email,password,role,auth_method,subscription_plan,daily_recipe_count) VALUES (1,?,'hash','USER','CREDENTIALS','FREE',0)","upgrade-"+UUID.randomUUID()+"@example.com");
            UUID planId=UUID.randomUUID(),batchId=UUID.randomUUID(),transferId=UUID.randomUUID();
            legacy.update("INSERT INTO meal_plan (id,user_id,version,created_at,document) VALUES (?,1,0,CURRENT_TIMESTAMP,'{}')",planId);
            legacy.update("INSERT INTO prepared_portion_transfer (id,source_plan_id,batch_id,target_plan_id,slot_id,portions,eaten,released) VALUES (?,?,?,?,?,2,1,FALSE)",transferId,planId,batchId,planId,UUID.randomUUID());
            org.flywaydb.core.Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()).schemas(schema).defaultSchema(schema).load().migrate();
            assertThat(legacy.queryForObject("SELECT eaten FROM prepared_portion_transfer WHERE id=?",Integer.class,transferId)).isEqualTo(1);
            assertThat(legacy.queryForObject("SELECT discarded FROM prepared_portion_transfer WHERE id=?",Integer.class,transferId)).isZero();
            assertThat(legacy.queryForObject("SELECT batch_id FROM prepared_portion_transfer WHERE id=?",UUID.class,transferId)).isEqualTo(batchId);
        } finally {
            jdbcTemplate.execute("DROP SCHEMA IF EXISTS "+schema+" CASCADE");
        }
    }

}
