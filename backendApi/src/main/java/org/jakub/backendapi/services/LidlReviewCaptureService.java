package org.jakub.backendapi.services;
import org.jakub.backendapi.dto.OfferImportDto.*;
import org.jakub.backendapi.dto.MealPlanDto.Store;
import org.jakub.backendapi.entities.OfferSourceRun;
import org.jakub.backendapi.repositories.OfferSourceRunRepository;
import org.springframework.stereotype.Service;
import tools.jackson.databind.*;
import java.net.URI;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;
/** Public source transport: review-only HTML evidence and bounded JSON catalog pages. */
@Service
public class LidlReviewCaptureService {
    public static final String SOURCE = "https://www.lidl.pl/c/zywnosc-i-napoje/s10068374";
    private static final Pattern DATA = Pattern.compile("<script(?=[^>]*\\bid=[\"']__NUXT_DATA__[\"'])[^>]*>(.*?)</script>", Pattern.DOTALL);
    private static final int MAX_BYTES = 10_000_000;
    public static final int PRICE_PAGE_SIZE = 48;
    public static final int MAX_PRICE_PAGES = 20;
    public record PricePage(int total, int items, List<JsonNode> products) {}
    public static String pricePageUrl(int offset) {
        if (offset < 0 || offset >= PRICE_PAGE_SIZE * MAX_PRICE_PAGES || offset % PRICE_PAGE_SIZE != 0)
            throw new IllegalArgumentException("Unsupported catalog offset");
        return "https://www.lidl.pl/q/api/search?assortment=PL&locale=pl_PL&version=v2.0.0&category.id=10068374&offset="
                + offset + "&fetchsize=" + PRICE_PAGE_SIZE;
    }
    public PricePage fetchPricePage(int offset) {
        return pricePage(fetchHtml(pricePageUrl(offset)), offset);
    }
    public PricePage pricePage(String body, int offset) {
        JsonNode data = json.readTree(body);
        if (!data.path("numFound").isIntegralNumber() || data.path("numFound").intValue() < 0
                || !data.path("offset").isIntegralNumber() || data.path("offset").intValue() != offset
                || !data.path("items").isArray() || data.path("items").size() > PRICE_PAGE_SIZE
                || !data.path("assortment").asText().equals("PL") || !data.path("locale").asText().equals("pl_PL"))
            throw new IllegalArgumentException("Unsupported catalog page");
        List<JsonNode> products = new ArrayList<>();
        for (JsonNode item : data.path("items")) {
            JsonNode product = item.path("gridbox").path("data");
            if (!item.path("type").asText().equals("product") || !product.isObject()
                    || product.path("productId").asText().isBlank()) throw new IllegalArgumentException("Unsupported catalog item");
            products.add(product);
        }
        return new PricePage(data.path("numFound").intValue(), data.path("items").size(), List.copyOf(products));
    }
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public record Run(UUID id, Instant fetchedAt, String status, UUID batchId, int candidates, String checksum) {}
    private final ObjectMapper json;
    private final OfferImportService imports;
    private final OfferSourceRunRepository runs;
    public LidlReviewCaptureService(ObjectMapper json, OfferImportService imports, OfferSourceRunRepository runs) { this.json = json; this.imports = imports; this.runs = runs; }
    public Run capture() {
        Instant fetched = Instant.now(); UUID id = UUID.randomUUID(); Run run;
        try {
            byte[] bytes = fetchHtml(SOURCE).getBytes(StandardCharsets.UTF_8);
            var candidates = parse(new String(bytes, StandardCharsets.UTF_8));
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            var batch = imports.ingest(new Input("lidl-html-review-v1", hash, Store.LIDL, fetched, null, false, candidates.size(), candidates));
            run = new Run(id, fetched, "INCOMPLETE_REVIEW_ONLY", batch.batch().id(), candidates.size(), hash);
        } catch (Exception failure) { run = new Run(id, fetched, "FETCH_OR_FORMAT_FAILED", null, 0, null); }
        var entity = new OfferSourceRun(); entity.setId(id); entity.setCreatedAt(fetched); entity.setStatus(run.status()); entity.setDocument(json.writeValueAsString(run)); runs.saveAndFlush(entity);
        return run;
    }
    public String fetchHtml(String source) {
        boolean catalogUrl = java.util.stream.IntStream.range(0, MAX_PRICE_PAGES)
                .anyMatch(page -> pricePageUrl(page * PRICE_PAGE_SIZE).equals(source));
        if (!SOURCE.equals(source) && !catalogUrl) throw new IllegalArgumentException("Unsupported price source");
        try {
            var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build();
            var request = HttpRequest.newBuilder(URI.create(source)).timeout(Duration.ofSeconds(20)).header("User-Agent", "DishGenie-SourceReview/1.0").GET().build();
            var response = client.sendAsync(request, info -> limitedBody()).orTimeout(25, TimeUnit.SECONDS).get();
            if (response.statusCode() != 200) throw new IllegalStateException("Source response unavailable");
            return new String(response.body(), StandardCharsets.UTF_8);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt(); throw new IllegalStateException("Source fetch interrupted", interrupted);
        } catch (Exception failure) { throw new IllegalStateException("Source fetch failed", failure); }
    }
    private HttpResponse.BodySubscriber<byte[]> limitedBody() {
        return new HttpResponse.BodySubscriber<>() {
            private final CompletableFuture<byte[]> body = new CompletableFuture<>();
            private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            private Flow.Subscription subscription;
            public CompletionStage<byte[]> getBody() { return body; }
            public void onSubscribe(Flow.Subscription value) { subscription = value; value.request(1); }
            public void onNext(List<ByteBuffer> buffers) {
                for (ByteBuffer buffer : buffers) {
                    if (buffer.remaining() > MAX_BYTES - bytes.size()) {
                        subscription.cancel(); body.completeExceptionally(new IllegalStateException("Source too large")); return;
                    }
                    byte[] part = new byte[buffer.remaining()]; buffer.get(part); bytes.writeBytes(part);
                }
                subscription.request(1);
            }
            public void onError(Throwable failure) { body.completeExceptionally(failure); }
            public void onComplete() { body.complete(bytes.toByteArray()); }
        };
    }
    public List<Run> recent() { return runs.findTop30ByOrderByCreatedAtDesc().stream().map(r -> json.readValue(r.getDocument(), Run.class)).toList(); }
    public List<Candidate> parse(String html) {
        List<Candidate> result = new ArrayList<>();
        for (JsonNode product : products(html)) {
            String productId = product.path("productId").asText();
            var evidence = json.createObjectNode();
            for (String key : List.of("fullTitle", "price", "storeStartDate", "storeEndDate", "regionsV2", "regionsPrices", "lidlPlus", "disclaimers", "stockAvailability")) evidence.set(key, product.path(key));
            result.add(new Candidate(productId, "https://www.lidl.pl" + product.path("canonicalUrl").asText(), json.writeValueAsString(evidence)));
        }
        if (result.stream().anyMatch(c -> c.evidence().length() > 10000)) throw new IllegalArgumentException("Oversized source evidence");
        return List.copyOf(result);
    }
    public List<JsonNode> products(String html) {
        var matcher = DATA.matcher(html); if (!matcher.find()) throw new IllegalArgumentException("Nuxt data absent");
        JsonNode data = json.readTree(matcher.group(1)); if (!data.isArray()) throw new IllegalArgumentException("Unsupported data");
        List<JsonNode> result = new ArrayList<>(); Set<String> seen = new HashSet<>();
        for (int i = 0; i < data.size(); i++) {
            var value = data.get(i);
            if (!value.isObject() || !value.has("productId") || !value.has("price") || !value.has("storeStartDate") || !value.has("storeEndDate")) continue;
            var product = resolve(data, i, Set.of()); String productId = product.path("productId").asText();
            if (productId.isBlank() || !seen.add(productId)) continue;
            String path = product.path("canonicalUrl").asText();
            if (!path.startsWith("/p/") || path.contains("?") || path.contains("#") || path.contains("\\")) throw new IllegalArgumentException("Unsupported source URL");
            result.add(product);
        }
        if (result.isEmpty() || result.size() > 500) throw new IllegalArgumentException("Incomplete or oversized source format");
        return List.copyOf(result);
    }
    private JsonNode resolve(JsonNode data, int index, Set<Integer> visited) {
        if (index < 0) return json.nullNode();
        if (index >= data.size() || visited.contains(index) || visited.size() > 60) throw new IllegalArgumentException("Unsupported reference");
        var next = new HashSet<>(visited); next.add(index); var value = data.get(index);
        if (value.isObject()) {
            var object = json.createObjectNode();
            value.properties().forEach(entry -> object.set(entry.getKey(), resolve(data, entry.getValue().intValue(), next)));
            return object;
        }
        if (value.isArray()) {
            if (value.size() > 0 && value.get(0).isTextual()) {
                if (value.size() != 2 || !Set.of("Ref", "Reactive", "ShallowReactive", "ShallowRef").contains(value.get(0).asText())) throw new IllegalArgumentException("Unsupported wrapper");
                return resolve(data, value.get(1).intValue(), next);
            }
            var array = json.createArrayNode(); value.forEach(ref -> array.add(resolve(data, ref.intValue(), next))); return array;
        }
        return value;
    }
}
