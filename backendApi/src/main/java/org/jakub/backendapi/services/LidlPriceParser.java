package org.jakub.backendapi.services;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.regex.*;

/** Supported public price formats only; reference prices are never assumed to be current regular prices. */
@Component
public class LidlPriceParser {
    private static final Set<String> REGIONS = Set.of("5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "18");
    private static final ZoneId ZONE = ZoneId.of("Europe/Warsaw");
    private static final Pattern PACK = Pattern.compile("(?i)^(\\d+(?:[,.]\\d+)?)\\s*(kg|g|l|ml|szt\\.?)$");
    private static final Pattern MINIMUM = Pattern.compile("przy zakupie (\\d+) (?:opak|szt)\\.");
    private static final Pattern MULTIPLE = Pattern.compile("wielokrotności (\\d+) (?:opak|szt)\\.");
    private static final Pattern LIMIT = Pattern.compile("(?i)limit: (\\d+(?:[,.]\\d+)?) (opak\\.|szt\\.|kg) na (?:kupon|paragon)\\.");
    private static final Pattern REGULAR = Pattern.compile("(?i)cena poza promocj[ąa]\\s*:\\s*(?:1\\s*(?:kg|l)\\s*=\\s*)?(\\d+(?:[,.]\\d{2}))");
    public record Price(String productId, String variant, String title, PriceIngredientKeys.Product ingredient,
                        BigDecimal amount, String unit, BigDecimal price, int minimum, int multiple,
                        Integer maximum, BigDecimal maximumAmount, boolean loyalty, boolean coupon,
                        LocalDate from, LocalDate to, String sourceUrl, String conditions) {}

    public List<Price> parse(JsonNode product, Instant now) {
        String title = product.path("keyfacts").path("title").asText("");
        var ingredient = PriceIngredientKeys.product(title);
        if (ingredient == null || !product.path("productType").asText().equals("RETAIL")) return List.of();
        var regions = product.path("regionsV2");
        Set<String> found = new HashSet<>(); regions.properties().forEach(e -> found.add(e.getKey()));
        if (!found.equals(REGIONS)) return List.of();
        if (regions.properties().stream().anyMatch(e -> !e.getValue().path("regionPriceId").asText().equals("1")
                || !e.getValue().path("status").asText().equals("ONLINE"))) return List.of();
        var prices = product.path("regionsPrices");
        if (prices.size() != 1 || !prices.has("1")) return List.of();
        List<Price> result = new ArrayList<>();
        add(product, prices.path("1").path("currentPrice"), ingredient, false, now, result);
        add(product, prices.path("1").path("currentLidlPlusPrice").path("price"), ingredient, true, now, result);
        return List.copyOf(result);
    }

    private void add(JsonNode product, JsonNode price, PriceIngredientKeys.Product ingredient, boolean loyalty,
                     Instant now, List<Price> result) {
        if (!price.isObject() || !price.path("price").isNumber() || !price.path("currencyCode").asText().equals("PLN")
                || price.path("variantsHaveDifferentPrices").asBoolean(true)) return;
        try {
            LocalDate from = Instant.ofEpochSecond(product.path("storeStartDate").longValue()).atZone(ZONE).toLocalDate();
            LocalDate to = Instant.ofEpochSecond(product.path("storeEndDate").longValue()).atZone(ZONE).toLocalDate();
            LocalDate priceFrom = Instant.parse(price.path("startDate").asText()).atZone(ZONE).toLocalDate();
            LocalDate priceTo = Instant.parse(price.path("endDate").asText()).atZone(ZONE).toLocalDate();
            from = from.isAfter(priceFrom) ? from : priceFrom; to = to.isBefore(priceTo) ? to : priceTo;
            LocalDate today = now.atZone(ZONE).toLocalDate();
            if (to.isBefore(from) || to.isBefore(today) || from.isAfter(today.plusDays(7))) return;
            Matcher pack = PACK.matcher(price.path("packaging").path("text").asText().trim());
            if (!pack.matches()) return;
            BigDecimal amount = decimal(pack.group(1)); String unit = pack.group(2).toLowerCase(Locale.ROOT);
            if (unit.equals("kg") || unit.equals("l")) amount = amount.multiply(BigDecimal.valueOf(1000));
            unit = unit.equals("kg") || unit.equals("g") ? "g" : unit.equals("ml") || unit.equals("l") ? "ml" : "pcs";
            if (amount.signum() <= 0 || amount.scale() > 3 || amount.compareTo(new BigDecimal("1000000")) > 0
                    || unit.equals("pcs") && amount.stripTrailingZeros().scale() > 0 || ingredient.weighted() && !unit.equals("g")) return;
            String terms = price.path("basePrice").path("text").asText("").trim();
            if (terms.length() > 850) return;
            String source = "https://www.lidl.pl" + product.path("canonicalUrl").asText();
            String title = product.path("fullTitle").asText();
            if (title.isBlank() || title.length() > 200 || !source.matches("https://www\\.lidl\\.pl/p/[a-zA-Z0-9/_–-]+")) return;
            String id = product.path("productId").asText();
            // A separately and explicitly stated outside-promotion price is usable without a coupon.
            Matcher regular = REGULAR.matcher(terms);
            if (regular.find()) {
                BigDecimal normal = decimal(regular.group(1));
                if (validMoney(normal)) result.add(new Price(id, "regular", title, ingredient, amount, unit, normal,
                        1, 1, null, null, false, false, from, to, source,
                        "Cena poza promocją podana przez sklep. " + terms));
            }
            String lower = terms.toLowerCase(Locale.ROOT);
            if (lower.matches(".*(gratis|mieszaj|różne|drugi|druga|trzeci|wybrane produkty).*")) return;
            int minimum = 1, multiple = 1; Integer maximum = null; BigDecimal maximumAmount = null;
            Matcher min = MINIMUM.matcher(lower);
            if (min.find()) minimum = Integer.parseInt(min.group(1));
            else if (lower.contains("przy zakupie")) return;
            Matcher mul = MULTIPLE.matcher(lower);
            if (mul.find()) multiple = Integer.parseInt(mul.group(1));
            else if (lower.contains("wielokrotno")) return;
            Matcher limit = LIMIT.matcher(lower);
            if (limit.find()) {
                if (limit.group(2).equals("kg")) maximumAmount = decimal(limit.group(1)).multiply(BigDecimal.valueOf(1000));
                else maximum = Integer.valueOf(limit.group(1));
            } else if (lower.contains("limit")) return;
            if (!loyalty && (lower.contains("kupon") || lower.contains("lidl plus") || lower.contains("aplikacj"))) return;
            if (ingredient.weighted() && (minimum != 1 || multiple != 1 || maximum != null)) return;
            if (!ingredient.weighted() && maximumAmount != null) return;
            if (minimum < 1 || multiple < 1 || minimum > 1000 || multiple > 1000 || maximum != null && (maximum < minimum || maximum > 1000)) return;
            if (maximum != null && ((minimum + multiple - 1) / multiple) * multiple > maximum) return;
            if (maximumAmount != null && (maximumAmount.signum() <= 0 || maximumAmount.compareTo(new BigDecimal("1000000")) > 0 || maximumAmount.scale() > 3)) return;
            BigDecimal cost = price.path("price").decimalValue();
            if (!validMoney(cost)) return;
            result.add(new Price(id, "promotion", title, ingredient, amount, unit, cost, minimum, multiple, maximum,
                    maximumAmount, loyalty, loyalty, from, to, source, terms.isBlank() ? "Cena z oficjalnej strony sklepu." : terms));
        } catch (RuntimeException unsupported) { /* Unknown formats remain unpriced; other products can still be imported. */ }
    }
    private BigDecimal decimal(String value) { return new BigDecimal(value.replace(',', '.')); }
    private boolean validMoney(BigDecimal value) { return value.signum() > 0 && value.scale() <= 2 && value.compareTo(new BigDecimal("100000")) <= 0; }
}
