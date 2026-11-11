package org.jakub.backendapi.services;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.*;
import tools.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class LidlPriceParserTest {
    private final ObjectMapper json = new ObjectMapper();
    private final LidlPriceParser parser = new LidlPriceParser();
    private final Instant now = Instant.parse("2026-11-06T10:00:00Z");
    @Test void currentCatalogueTitlesKeepPricesUnitsDatesAndBundleConditions() throws Exception {
        try (var stream = getClass().getResourceAsStream("/offers/lidl-prices-2026-11-08.json")) {
            Map<String, List<LidlPriceParser.Price>> prices = new HashMap<>();
            for (var p : json.readTree(stream)) prices.put(p.path("productId").asText(), parser.parse(p, Instant.parse("2026-11-08T12:00:00Z")));
            assertThat(prices.get("11029802")).singleElement().satisfies(p -> {
                assertThat(p.ingredient().key()).isEqualTo("tomato");
                assertThat(p.amount()).isEqualByComparingTo("500");
                assertThat(p.ingredient().weighted()).isFalse();
                assertThat(p.from()).hasToString("2026-11-09");
            });
            assertThat(prices.get("11219541")).anySatisfy(p -> {
                assertThat(p.ingredient().key()).isEqualTo("gouda");
                assertThat(p.minimum()).isEqualTo(2); assertThat(p.multiple()).isEqualTo(2);
                assertThat(p.maximum()).isEqualTo(6);
            });
            assertThat(prices.get("11151073")).hasSize(2).anySatisfy(p -> {
                assertThat(p.loyalty()).isTrue(); assertThat(p.maximumAmount()).isEqualByComparingTo("2000");
            });
            assertThat(prices.get("11412175")).anySatisfy(p -> {
                assertThat(p.ingredient().key()).isEqualTo("pork-mince");
                assertThat(p.ingredient().weighted()).isFalse(); assertThat(p.amount()).isEqualByComparingTo("1000");
            });
            assertThat(prices.get("11412197")).as("Unknown variable-weight meat packs remain unsupported").isEmpty();
            assertThat(prices.get("11434066")).as("Confectionery is excluded").isEmpty();
        }
        assertThat(PriceIngredientKeys.product("Ser gouda w\u00a0kawałku, XXL").key()).isEqualTo("gouda");
        assertThat(PriceIngredientKeys.recipeKey("zucchini")).isEqualTo("zucchini");
    }
    private JsonNode fixture(String id) throws Exception {
        try (var stream = getClass().getResourceAsStream("/offers/lidl-prices-2026-11-06.json")) {
            for (var item : json.readTree(stream)) if (item.path("productId").asText().equals(id)) return item;
        }
        throw new IllegalArgumentException(id);
    }
    @Test void actualMilkSourceSeparatesTheOutsidePromotionPriceFromSixPackCouponConditions() throws Exception {
        var prices = parser.parse(fixture("11421274"), now);
        assertThat(prices).hasSize(2);
        var regular = prices.stream().filter(p -> p.variant().equals("regular")).findFirst().orElseThrow();
        assertThat(regular.price()).isEqualByComparingTo("3.99");
        assertThat(regular.loyalty()).isFalse(); assertThat(regular.minimum()).isEqualTo(1);
        var coupon = prices.stream().filter(LidlPriceParser.Price::coupon).findFirst().orElseThrow();
        assertThat(coupon.price()).isEqualByComparingTo("1.99"); assertThat(coupon.amount()).isEqualByComparingTo("1000");
        assertThat(coupon.unit()).isEqualTo("ml"); assertThat(coupon.minimum()).isEqualTo(6);
        assertThat(coupon.multiple()).isEqualTo(6); assertThat(coupon.maximum()).isEqualTo(12);
        assertThat(coupon.to()).hasToString("2026-11-07");
    }
    @Test void anUnimplementedFreeItemMechanismNeverTurnsIntoAnInventedDiscount() throws Exception {
        var prices = parser.parse(fixture("11214533"), now);
        assertThat(prices).singleElement().satisfies(p -> {
            assertThat(p.variant()).isEqualTo("regular"); assertThat(p.price()).isEqualByComparingTo("3.49");
            assertThat(p.unit()).isEqualTo("pcs"); assertThat(p.loyalty()).isFalse();
        });
    }
    @Test void looseApplePriceIsAWeightBasisNotAnInventedOneKilogramPackage() throws Exception {
        assertThat(parser.parse(fixture("11214563"), now)).singleElement().satisfies(p -> {
            assertThat(p.ingredient().weighted()).isTrue(); assertThat(p.amount()).isEqualByComparingTo("1000");
            assertThat(p.price()).isEqualByComparingTo("2.49"); assertThat(p.loyalty()).isFalse();
        });
    }
    @Test void missingRegionsDifferentRegionalPricesAndExpiredPricesCannotBePublished() throws Exception {
        ObjectNode product = (ObjectNode) fixture("11214563");
        ((ObjectNode) product.path("regionsV2")).remove("18");
        assertThat(parser.parse(product, now)).isEmpty();
        product = (ObjectNode) fixture("11214563");
        ((ObjectNode) product.path("regionsV2").path("5")).put("regionPriceId", "2");
        assertThat(parser.parse(product, now)).isEmpty();
        assertThat(parser.parse(fixture("11214563"), Instant.parse("2026-11-08T12:00:00Z"))).isEmpty();
    }
    @Test void unknownIngredientsAndUnsupportedConditionsAreNotGuessed() throws Exception {
        ObjectNode product = (ObjectNode) fixture("11214563");
        ((ObjectNode) product.path("keyfacts")).put("title", "Unknown food");
        assertThat(parser.parse(product, now)).isEmpty();
        product = (ObjectNode) fixture("11214563");
        ((ObjectNode) product.path("regionsPrices").path("1").path("currentPrice").path("basePrice")).put("text", "Limit: uzależniony od paragonu");
        assertThat(parser.parse(product, now)).isEmpty();
    }
    @Test void ingredientMatchingIsBilingualButDoesNotMergeDifferentFoodsOrCookingStates() {
        assertThat(PriceIngredientKeys.recipeKey("garlic, minced")).isEqualTo("garlic");
        assertThat(PriceIngredientKeys.recipeKey("czosnek")).isEqualTo("garlic");
        assertThat(PriceIngredientKeys.recipeKey("rice")).isEqualTo("rice");
        for (String name : List.of("cooked rice", "ryż ugotowany", "almond milk", "skimmed milk", "canned tomatoes", "garlic powder"))
            assertThat(PriceIngredientKeys.recipeKey(name)).as(name).isNull();
    }
    @Test void additionalCategoriesUseVerifiedPackSizesAndKeepUnsupportedFreeOffersOut() throws Exception {
        try (var stream = getClass().getResourceAsStream("/offers/lidl-categories-2026-11-07.json")) {
            Map<String, List<LidlPriceParser.Price>> byId = new HashMap<>();
            for (var product : json.readTree(stream)) byId.put(product.path("productId").asText(), parser.parse(product, now));
            assertThat(byId.get("11433248")).anySatisfy(p -> {
                assertThat(p.amount()).isEqualByComparingTo("400"); assertThat(p.price()).isEqualByComparingTo("8.99");
                assertThat(p.maximum()).isEqualTo(6); assertThat(p.ingredient().key()).isEqualTo("smoked-pork-loin");
            });
            assertThat(byId.get("11436970")).anySatisfy(p -> {
                assertThat(p.amount()).isEqualByComparingTo("800"); assertThat(p.price()).isEqualByComparingTo("17.99");
            });
            assertThat(byId.get("11438030")).singleElement().satisfies(p -> {
                assertThat(p.variant()).isEqualTo("regular"); assertThat(p.price()).isEqualByComparingTo("24.99");
                assertThat(p.amount()).isEqualByComparingTo("550");
            });
            assertThat(byId.get("11406146")).as("Ready-made sweet pastries are not meal ingredients").isEmpty();
            for (String rawMeat : List.of("11263684", "11305114", "11407883")) assertThat(byId.get(rawMeat)).isEmpty();
        }
        assertThat(PriceIngredientKeys.recipeKey("smoked pork loin")).isEqualTo("smoked-pork-loin");
        assertThat(PriceIngredientKeys.recipeKey("raw pork loin")).isNull();
    }
    @Test void collectionTargetsMealIngredientsRatherThanReadyMadeTreats() {
        for (String title : List.of("Rogal świętomarciński", "Pączek z lukrem", "Ciastka czekoladowe", "Chipsy ziemniaczane", "Napój energetyczny")) {
            assertThat(PriceIngredientKeys.product(title)).as(title).isNull();
        }
        for (String key : List.of("apple", "milk", "butter", "rice", "tomato", "turkey-breast", "olive-oil"))
            assertThat(PriceIngredientKeys.isMealIngredient(key)).as(key).isTrue();
        assertThat(PriceIngredientKeys.isMealIngredient("st-martin-croissant")).isFalse();
        assertThat(PriceIngredientKeys.isMealIngredient(null)).isFalse();
    }
}
