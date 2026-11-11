package org.jakub.backendapi.services;

import java.text.Normalizer;
import java.util.*;

/** Explicit meal-ingredient identities. Ready-made sweets, snacks and soft drinks are not collected. */
public final class PriceIngredientKeys {
    private PriceIngredientKeys() {}
    private static final Map<String, String> NAMES = new HashMap<>();
    static {
        add("apple", "jabłko", "jabłka", "apple", "apples");
        add("plum", "śliwka", "śliwki", "plum", "plums");
        add("banana", "banan", "banany", "banana", "bananas");
        add("mango", "mango"); add("mandarin", "mandarynka", "mandarynki", "mandarin", "mandarins");
        add("pomegranate", "granat", "pomegranate"); add("kiwi-gold", "kiwi gold");
        add("butter", "masło", "butter"); add("milk", "mleko", "milk", "whole milk");
        add("edam", "ser edam", "edam", "edam cheese");
        add("quark-cheesecake", "twaróg sernikowy", "twarog sernikowy");
        add("turkey-breast", "filet z indyka", "pierś z indyka", "turkey breast", "turkey breast fillet");
        add("pork-ham-raw", "szynka wieprzowa surowa", "raw pork ham");
        add("duck-whole", "kaczka tuszka", "whole duck"); add("mayonnaise", "majonez", "mayonnaise");
        add("tomato", "pomidor", "pomidory", "tomato", "tomatoes");
        add("onion", "cebula", "onion", "onions"); add("garlic", "czosnek", "garlic", "garlic cloves");
        add("carrot", "marchew", "marchewka", "carrot", "carrots");
        add("potato", "ziemniak", "ziemniaki", "potato", "potatoes");
        add("rice", "ryż", "rice"); add("olive-oil", "oliwa z oliwek", "olive oil");
        add("kaki", "kaki", "persimmon"); add("grape-dark", "winogrona ciemne", "dark grapes");
        add("pomelo", "pomelo", "pomelo żółte"); add("orange", "pomarańcza", "pomarańcze", "orange", "oranges");
        add("melon-yellow", "melon żółty", "yellow melon");
        add("zucchini", "cukinia", "zucchini", "courgette");
        add("butternut-squash", "dynia piżmowa", "butternut squash");
        add("avocado", "awokado", "avocado"); add("gouda", "ser gouda", "gouda", "gouda cheese");
        add("pork-mince", "mięso mielone wieprzowe", "mięso mielone z łopatki wieprzowej", "minced pork", "ground pork");
        add("smoked-pork-loin", "schab wędzony", "schab wędzony wiśnią", "smoked pork loin");
        add("krakowska-sausage", "kiełbasa krakowska z szynki", "krakowska sausage");
        add("silesian-sausage", "kiełbasa śląska", "silesian sausage");
        add("cucumber", "ogórek", "ogórek zielony", "ogórek długi zielony", "cucumber", "green cucumber");
        add("hokkaido-squash", "dynia hokkaido", "hokkaido pumpkin", "hokkaido squash");
        add("pointed-cabbage", "kapusta stożkowa", "pointed cabbage");
        add("nectarine", "nektarynka", "nektarynki", "nectarine", "nectarines");
        add("pear", "gruszka", "gruszki", "pear", "pears");
        add("grapefruit", "grejpfrut czerwony", "red grapefruit");
        add("mustard-bread", "chleb z musztardą francuską", "French mustard bread");
        add("mountain-bread", "chleb górski", "mountain bread");
        add("lumberjack-bread", "chleb drwala", "lumberjack bread");
        add("sourdough-roll", "bułka na zakwasie", "sourdough roll");
        add("poznan-roll", "bułka poznańska", "Poznan roll");
        add("olive-oil-roll", "bułka z oliwą z oliwek", "olive oil roll");
        add("skyr-roll", "bułka ze skyrem", "skyr roll");
        add("milk-roll", "bułka mleczna", "milk roll");
        add("provita-roll", "bułka pełnoziarnista Provita", "Provita wholegrain roll");
        add("rye-fibre-roll", "bułka wysokobłonnikowa z mąką żytnią", "high fibre rye roll");
        add("pork-neck-mince", "mięso mielone z karkówki", "minced pork neck", "ground pork neck");
        add("veal-burger", "burger cielęcy", "burgery cielęce", "veal burger", "veal burgers");
        add("chicken-mince", "mięso mielone z kurczaka", "mielone mięso z kurczaka", "minced chicken", "ground chicken");
        add("turkey-parsley-roll", "rolada indycza z pietruszką", "turkey roll with parsley");
        add("dry-krakowska", "kiełbasa krakowska sucha staropolska", "dry Krakowska sausage");
        add("mysliwska-sausage", "kiełbasa myśliwska staropolska", "hunter's sausage");
        add("kabanos", "kabanosy staropolskie", "traditional kabanos");
        add("ham-frankfurter", "frankfurterki z szynki", "ham frankfurters");
        add("cooked-whole-shrimp", "krewetki całe gotowane z głową", "cooked whole head-on shrimp");
        add("krolewiecki-cheese", "ser Królewiecki Szwajcar", "Królewiecki Szwajcar cheese");
        add("fruit-skyr", "skyr owocowy", "fruit skyr");
        add("protein-cream-cheese", "serek proteinowy", "protein cream cheese");
        add("freeze-dried-strawberry", "truskawka liofilizowana", "truskawki liofilizowane", "freeze dried strawberry", "freeze dried strawberries");
        add("split-peas", "groch łuskany", "split peas", "dried split peas");
        add("airfryer-vegetables", "mieszanka warzyw do airfryera", "airfryer vegetable mix");
        add("fruit-puree", "mus owocowy", "fruit puree");
    }
    private static final Set<String> MEAL_INGREDIENTS = Set.copyOf(NAMES.values());
    public static boolean isMealIngredient(String key) { return MEAL_INGREDIENTS.contains(key == null ? "" : key); }
    private static void add(String key, String... aliases) { for (String alias : aliases) NAMES.put(normalize(alias), key); }
    public static String normalize(String name) {
        return Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replace('ł', 'l').replaceAll("[\\s\\p{Z}]+", " ").trim();
    }
    public static String recipeKey(String name) {
        String value = normalize(name);
        // Only remove preparation suffixes which do not change the food's identity or cooked/raw state.
        value = value.replaceFirst(",\\s*(?:(?:finely |roughly )?(?:chopped|diced|minced|sliced|grated)|posiekany|posiekana|pokrojony|pokrojona)(?: and (?:chopped|diced|minced|sliced|grated))?$", "");
        return NAMES.get(value);
    }
    public record Product(String key, String ingredientName, String category, boolean weighted) {}
    public static Product product(String title) {
        String value = normalize(title);
        // A brand prefix does not change the ingredient; variants and preparation still do.
        value = value.replaceFirst("^(?:mlekovita|pilos)\\s+", "");
        // Match food names plus explicit merchandising/variety suffixes, never arbitrary substring matches.
        if (value.matches("pomidory(?: truskawowe| malinowe| koktajlowe)?(?:, luzem)?"))
            return new Product("tomato", "pomidor", "VEGETABLES", value.endsWith(", luzem"));
        if (value.equals("kaki")) return new Product("kaki", "kaki", "FRUIT", false);
        if (value.equals("winogrona ciemne, luzem")) return new Product("grape-dark", "winogrona ciemne", "FRUIT", true);
        if (value.equals("pomelo zolte, luzem")) return new Product("pomelo", "pomelo", "FRUIT", true);
        if (value.matches("pomarancze(?: deserowe)?, luzem")) return new Product("orange", "pomarańcza", "FRUIT", true);
        if (value.equals("melon zolty, luzem")) return new Product("melon-yellow", "melon żółty", "FRUIT", true);
        if (value.equals("cukinia, luzem")) return new Product("zucchini", "cukinia", "VEGETABLES", true);
        if (value.equals("dynia pizmowa, luzem")) return new Product("butternut-squash", "dynia piżmowa", "VEGETABLES", true);
        if (value.matches("awokado(?: zielone| hass)?")) return new Product("avocado", "awokado", "FRUIT", false);
        if (value.matches("ser gouda (?:w kawalku|w plastrach)(?:, xxl)?")) return new Product("gouda", "ser gouda", "DAIRY", false);
        if (value.equals("mieso mielone z lopatki wieprzowej, xxl")) return new Product("pork-mince", "mięso mielone wieprzowe", "MEAT_FISH", false);
        if (value.matches("(?:polskie )?jablka czerwone, luzem")) return new Product("apple", "jabłko", "FRUIT", true);
        if (value.matches("sliwki okragle, luzem")) return new Product("plum", "śliwka", "FRUIT", true);
        if (value.equals("banany, luzem")) return new Product("banana", "banan", "FRUIT", true);
        if (value.equals("mango, luzem")) return new Product("mango", "mango", "FRUIT", true);
        if (value.equals("mandarynki, luzem")) return new Product("mandarin", "mandarynka", "FRUIT", true);
        if (value.equals("granat, luzem")) return new Product("pomegranate", "granat", "FRUIT", true);
        if (value.equals("kiwi gold")) return new Product("kiwi-gold", "kiwi gold", "FRUIT", false);
        if (value.matches("maslo(?: ekstra|, mleczna krowa,)? (?:82|83)%")) return new Product("butter", "masło", "DAIRY", false);
        if (value.equals("ogorek dlugi zielony")) return new Product("cucumber", "ogórek", "VEGETABLES", false);
        if (value.equals("dynia hokkaido, luzem")) return new Product("hokkaido-squash", "dynia hokkaido", "VEGETABLES", true);
        if (value.equals("kapusta stozkowa, luzem")) return new Product("pointed-cabbage", "kapusta stożkowa", "VEGETABLES", true);
        if (value.equals("nektarynki, luzem")) return new Product("nectarine", "nektarynka", "FRUIT", true);
        if (value.equals("mleko uht 3,2% z polskiej mleczarni")) return new Product("milk", "mleko", "DAIRY", false);
        if (value.equals("ser edam w plastrach, xxl")) return new Product("edam", "ser edam", "DAIRY", false);
        if (value.equals("polski twarog sernikowy 6%")) return new Product("quark-cheesecake", "twaróg sernikowy", "DAIRY", false);
        if (value.equals("schab wedzony wisnia, xxl")) return new Product("smoked-pork-loin", "schab wędzony wiśnią", "MEAT_FISH", false);
        if (value.equals("pikok premium kielbasa krakowska z szynki, xxl")) return new Product("krakowska-sausage", "kiełbasa krakowska z szynki", "MEAT_FISH", false);
        if (value.equals("kielbasa slaska, xxl")) return new Product("silesian-sausage", "kiełbasa śląska", "MEAT_FISH", false);
        // Meat advertised per kg can still require a whole variable-weight pack or carcass; its minimum is unknown.
        if (value.equals("majonez klasyczny z zoltkami jaj od kur z wolnego wybiegu")) return new Product("mayonnaise", "majonez", "OTHER", false);
        return null;
    }
}
