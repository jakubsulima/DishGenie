package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.StoreOfferDto.LeafletSummary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Runs the same bounded, native-PDF importer used for source review. No model API. */
@Service
public class LidlLeafletImportService {
    public record Batch(List<LidlPriceParser.Price> prices, LeafletSummary summary) {}
    private final ObjectMapper json;
    private final boolean enabled;
    private final String python;
    private final String sourceUrl;
    private final Path work;
    public LidlLeafletImportService(ObjectMapper json,
            @Value("${app.offers.lidl-leaflet-import-enabled:true}") boolean enabled,
            @Value("${app.offers.lidl-leaflet-python:python3}") String python,
            @Value("${app.offers.lidl-leaflet-url:https://www.lidl.pl/l/pl/gazetki/gazetka-12-11-czw-kw46/ar/0}") String sourceUrl,
            @Value("${app.offers.lidl-leaflet-work-dir:${java.io.tmpdir}/dishgenie-lidl-leaflet}") String work) {
        this.json = json; this.enabled = enabled; this.python = python; this.sourceUrl = sourceUrl; this.work = Path.of(work);
    }
    public boolean enabled() { return enabled; }
    public Batch fetch(boolean force) {
        Path output = null;
        Process process = null;
        try {
            Files.createDirectories(work);
            // Each invocation has its own outputs; only the content-addressed source cache is shared.
            output = Files.createTempDirectory(work, "import-");
            for (String name : List.of("import_lidl_leaflet.py", "lidl-2026-11-12-review.json")) {
                try (var input = new ClassPathResource("offers/" + name).getInputStream()) {
                    Files.copy(input, output.resolve(name), StandardCopyOption.REPLACE_EXISTING);
                }
            }
            List<String> command = new ArrayList<>(List.of(python, output.resolve("import_lidl_leaflet.py").toString(),
                    "--flyer-url", sourceUrl, "--output", output.toString(), "--cache-dir", work.resolve("cache").toString(),
                    "--publication-review", output.resolve("lidl-2026-11-12-review.json").toString()));
            if (force) command.add("--refresh");
            Path log = output.resolve("import.log");
            process = new ProcessBuilder(command).redirectErrorStream(true).redirectOutput(log.toFile()).start();
            if (!process.waitFor(90, TimeUnit.SECONDS)) {
                process.destroyForcibly(); process.waitFor(5, TimeUnit.SECONDS);
                throw new IllegalStateException("LEAFLET_TIMEOUT");
            }
            if (process.exitValue() != 0) {
                String message = Files.size(log) < 100_000 ? Files.readString(log) : "";
                throw new IllegalStateException(message.contains("UNREVIEWED_LEAFLET") ? "UNREVIEWED_LEAFLET" : "LEAFLET_FETCH_OR_FORMAT_FAILED");
            }
            Path result = output.resolve("offers.json");
            if (Files.size(result) > 10_000_000) throw new IllegalStateException("LEAFLET_OUTPUT_TOO_LARGE");
            return parse(json.readTree(Files.readString(result)), Instant.now());
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt(); throw new IllegalStateException("LEAFLET_INTERRUPTED", interrupted);
        } catch (java.io.IOException failure) {
            throw new IllegalStateException("LEAFLET_RUNTIME_UNAVAILABLE", failure);
        } finally {
            if (process != null && process.isAlive()) process.destroyForcibly();
            if (output != null) try (var paths = Files.walk(output)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            } catch (java.io.IOException ignored) { /* A failed cleanup must not undo a completed import. */ }
        }
    }
    Batch parse(JsonNode result, Instant fetchedAt) {
        JsonNode summary = result.path("summary");
        if (!result.path("applicationOffers").isArray() || result.path("applicationOffers").isEmpty()
                || summary.path("reviewedCandidates").intValue() != summary.path("candidates").intValue()
                || result.path("pages").size() != summary.path("pages").intValue()
                || summary.path("pages").intValue() < 1 || summary.path("pages").intValue() > 200)
            throw new IllegalStateException("LEAFLET_INCOMPLETE_REVIEW");
        String source = result.path("source").path("flyerUrlAbsolute").asText();
        if (!source.matches("https://www\\.lidl\\.pl/l/pl/gazetki/[a-z0-9-]+/ar/0(?:\\?_ab=1)?"))
            throw new IllegalStateException("LEAFLET_INVALID_SOURCE");
        List<LidlPriceParser.Price> prices = new ArrayList<>();
        LocalDate today = fetchedAt.atZone(ZoneId.of("Europe/Warsaw")).toLocalDate();
        for (var row : result.path("applicationOffers")) {
            LocalDate from = LocalDate.parse(row.path("validFrom").asText());
            LocalDate to = LocalDate.parse(row.path("validTo").asText());
            if (to.isBefore(from)) throw new IllegalStateException("LEAFLET_INVALID_DATES");
            if (to.isBefore(today) || from.isAfter(today.plusDays(7))) continue;
            String key = row.path("ingredientKey").asText();
            if (!PriceIngredientKeys.isMealIngredient(key)) throw new IllegalStateException("LEAFLET_UNSUPPORTED_INGREDIENT: " + key);
            var ingredient = new PriceIngredientKeys.Product(key, row.path("ingredientName").asText(),
                    row.path("category").asText(), row.path("weighted").asBoolean());
            var promotional = new LidlPriceParser.Price(row.path("productId").asText(), "promotion", row.path("title").asText(), ingredient,
                    decimal(row, "amount"), row.path("unit").asText(), decimal(row, "price"), row.path("minimum").intValue(),
                    row.path("multiple").intValue(), integer(row, "maximum"), decimal(row, "maximumAmount"),
                    row.path("loyalty").asBoolean(), row.path("coupon").asBoolean(), from, to, source,
                    row.path("conditions").asText(), decimal(row, "bundlePrice"), integer(row, "bundleSize"));
            prices.add(promotional);
            // A separately transcribed current outside-promotion price is a genuine alternative.
            BigDecimal regular = decimal(row, "regularPrice");
            if (regular != null) prices.add(new LidlPriceParser.Price(promotional.productId(), "regular", promotional.title(), ingredient,
                    promotional.amount(), promotional.unit(), regular, 1, 1, null, null, false, false, from, to, source,
                    "Gazetka Lidla, str. " + row.path("page").intValue() + ". Cena poza promocją podana przez sklep."));
        }
        Map<String, Integer> rejected = new TreeMap<>();
        summary.path("reviewReasons").properties().forEach(e -> rejected.put(e.getKey(), e.getValue().intValue()));
        JsonNode measurement = result.path("measurement");
        var info = new LeafletSummary(result.path("source").path("title").asText(), source,
                result.path("pdfSha256").asText(), LocalDate.parse(result.path("source").path("offerStartDate").asText()),
                summary.path("pages").intValue(), summary.path("candidates").intValue(),
                summary.path("reviewedCandidates").intValue(), summary.path("reviewedProducts").intValue(), prices.size(),
                Map.copyOf(rejected), measurement.path("totalSeconds").doubleValue(), measurement.path("paidModelApiCostUsd").asText("0.00"),
                measurement.path("cacheHit").asBoolean());
        return new Batch(List.copyOf(prices), info);
    }
    private static BigDecimal decimal(JsonNode row, String field) {
        return row.path(field).isMissingNode() || row.path(field).isNull() ? null : new BigDecimal(row.path(field).asText());
    }
    private static Integer integer(JsonNode row, String field) { return row.path(field).isNull() ? null : row.path(field).intValue(); }
}
