package org.jakub.backendapi.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.entities.Enums.Unit;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriComponentsBuilder;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);
    private static final String GENERIC_GEMINI_ERROR_MESSAGE =
            "Recipe generation service is temporarily unavailable. Please try again later.";

    private static final long MAX_RECEIPT_FILE_SIZE_BYTES = 5L * 1024L * 1024L;
    private static final int MAX_IMAGE_DIMENSION = 6000;
    private static final int MAX_RETRY_ATTEMPTS = 3;
    private static final int GEMINI_CONNECT_TIMEOUT_MS = 10_000;
    private static final int GEMINI_READ_TIMEOUT_MS = 45_000;
    private static final int MIN_RECIPE_COUNT = 1;
    private static final int MAX_RECIPE_COUNT = 5;
    private static final String INVALID_RECIPE_JSON_MESSAGE =
            "Gemini returned recipe JSON in an invalid format.";

    private static final Set<String> SUPPORTED_UNITS =
            java.util.Arrays.stream(Unit.values()).map(Enum::name).collect(Collectors.toSet());

    private static final Set<String> ALLOWED_IMAGE_CONTENT_TYPES = Set.of(
            MediaType.IMAGE_JPEG_VALUE,
            MediaType.IMAGE_PNG_VALUE,
            "image/webp"
    );

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    @Value("${gemini.api.model:gemini-3.1-flash-lite-preview}")
    private String geminiModel;

    @Value("${gemini.api.fallback-model:gemma-4-31b-it}")
    private String geminiFallbackModel;

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public GeminiService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(GEMINI_CONNECT_TIMEOUT_MS);
        requestFactory.setReadTimeout(GEMINI_READ_TIMEOUT_MS);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public String generateRecipe(String recipePrompt) {
        return generateValidatedRecipeResponse(recipePrompt, 1);
    }

    public String generateRecipes(String recipePrompt, Integer requestedCount) {
        int recipeCount = normalizeRecipeCount(requestedCount);
        if (recipeCount == 1) {
            return generateValidatedRecipeResponse(recipePrompt, 1);
        }

        String batchPrompt = recipePrompt + """

                Additional requirement:
                - Generate %d truly different recipes (not small variations).
                - Each recipe must differ in at least three of these dimensions: cuisine, core ingredients, cooking method, flavor profile.
                - Do not repeat the same main protein or base ingredient across recipes.
                - Keep each recipe realistic and fully cookable.
                - Return ONLY valid JSON with this exact structure:
                {"recipes":[{"name":string,"description":string,"timeToPrepare":string,"ingredients":[{"name":string,"amount":number,"unit":string}],"instructions":[string],"nutrition":{"calories":number,"protein":number,"carbs":number,"fats":number}}]}
                - The recipes array must contain exactly %d items.
                """.formatted(recipeCount, recipeCount);

        return generateValidatedRecipeResponse(batchPrompt, recipeCount);
    }

    private String generateValidatedRecipeResponse(String recipePrompt, int expectedRecipeCount) {
        if (!StringUtils.hasText(geminiApiKey)) {
            throw new AppException("Gemini API key is not configured on the server.", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        Map<String, Object> payload = buildTextPromptPayload(recipePrompt);
        JsonNode responseBody = invokeGemini(payload, "Error creating recipe");

        String textResponse = extractTextFromGeminiResponse(responseBody);
        if (!StringUtils.hasText(textResponse)) {
            throw new AppException("Gemini returned an empty recipe response.", HttpStatus.BAD_GATEWAY);
        }

        return parseAndValidateGeneratedRecipeResponse(textResponse, expectedRecipeCount);
    }

    private int normalizeRecipeCount(Integer requestedCount) {
        if (requestedCount == null) {
            return MIN_RECIPE_COUNT;
        }
        return Math.max(MIN_RECIPE_COUNT, Math.min(MAX_RECIPE_COUNT, requestedCount));
    }

    public List<FridgeIngredientDto> extractFridgeIngredientsFromReceipt(MultipartFile file) {
        if (!StringUtils.hasText(geminiApiKey)) {
            throw new AppException("Gemini API key is not configured on the server.", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        ValidatedReceiptImage image = validateAndReadReceiptImage(file);

        String prompt = """
                You are extracting grocery receipt items for a cooking app.
                Return ONLY strict JSON with this exact structure:
                {"items":[{"name":"string","amount":number|null,"unit":"GRAMS|KILOGRAMS|LITERS|MILLILITERS|PIECES|null"}]}
                Rules:
                - Keep only food ingredients, skip non-food products.
                - If amount is unknown, return null.
                - If unit is unknown, return null.
                - Use one object per detected item.
                - Do not add any text outside JSON.
                """;

        String base64Data = Base64.getEncoder().encodeToString(image.bytes());

        Map<String, Object> inlineData = new HashMap<>();
        inlineData.put("mime_type", image.mimeType());
        inlineData.put("data", base64Data);

        List<Object> parts = new ArrayList<>();
        parts.add(Map.of("text", prompt));
        parts.add(Map.of("inline_data", inlineData));

        Map<String, Object> content = new HashMap<>();
        content.put("parts", parts);

        Map<String, Object> payload = new HashMap<>();
        payload.put("contents", List.of(content));

        JsonNode responseBody = invokeGemini(payload, "Gemini receipt scan request failed");
        String rawJsonText = cleanJsonPayload(extractTextFromGeminiResponse(responseBody));
        return parseReceiptItems(rawJsonText);
    }

    private Map<String, Object> buildTextPromptPayload(String prompt) {
        List<Object> parts = new ArrayList<>();
        parts.add(Map.of("text", prompt));

        Map<String, Object> content = new HashMap<>();
        content.put("parts", parts);

        Map<String, Object> payload = new HashMap<>();
        payload.put("contents", List.of(content));

        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("responseMimeType", "application/json");
        payload.put("generationConfig", generationConfig);
        return payload;
    }

    private JsonNode invokeGemini(Map<String, Object> payload, String operationLabel) {
        List<String> modelsToTry = new ArrayList<>();
        modelsToTry.add(geminiModel);

        if (StringUtils.hasText(geminiFallbackModel)
                && !geminiModel.equalsIgnoreCase(geminiFallbackModel)) {
            modelsToTry.add(geminiFallbackModel);
        }

        for (int modelIndex = 0; modelIndex < modelsToTry.size(); modelIndex++) {
            String modelToUse = modelsToTry.get(modelIndex);
            boolean canFallback = modelIndex == 0 && modelIndex + 1 < modelsToTry.size();

            try {
                return invokeGeminiWithModel(payload, modelToUse);
            } catch (RestClientResponseException e) {
                if (canFallback && shouldFallbackToAlternativeModel(e)) {
                    log.warn(
                            "Primary Gemini model '{}' failed with status {}. Falling back to '{}'.",
                            modelToUse,
                            e.getStatusCode().value(),
                            modelsToTry.get(modelIndex + 1)
                    );
                    continue;
                }
                throw mapGeminiResponseException(operationLabel, e);
            } catch (RestClientException e) {
                if (canFallback) {
                    log.warn(
                            "Primary Gemini model '{}' failed due to transport error. Falling back to '{}'. Cause: {}",
                            modelToUse,
                            modelsToTry.get(modelIndex + 1),
                            e.getMessage()
                    );
                    continue;
                }
                throw mapGeminiTransportException(operationLabel, e);
            }
        }

        throw new AppException(operationLabel + ": all configured AI models failed.", HttpStatus.BAD_GATEWAY);
    }

    private JsonNode invokeGeminiWithModel(Map<String, Object> payload, String modelToUse) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-goog-api-key", geminiApiKey);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
        String endpoint = UriComponentsBuilder
                .fromHttpUrl("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent")
                .buildAndExpand(modelToUse)
                .toUriString();

        long backoffMillis = 300L;
        for (int attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
            try {
                ResponseEntity<JsonNode> response = restTemplate.exchange(endpoint, HttpMethod.POST, request, JsonNode.class);
                return response.getBody();
            } catch (RestClientResponseException e) {
                int statusCode = e.getStatusCode().value();
                boolean retryableStatus = e.getStatusCode().is5xxServerError() || statusCode == 429;
                if (retryableStatus && attempt < MAX_RETRY_ATTEMPTS) {
                    sleepWithBackoff(backoffMillis);
                    backoffMillis *= 2;
                    continue;
                }
                throw e;
            } catch (RestClientException e) {
                if (attempt == MAX_RETRY_ATTEMPTS) {
                    throw e;
                }
                sleepWithBackoff(backoffMillis);
                backoffMillis *= 2;
            }
        }

        throw new RestClientException("retry limit exceeded");
    }

    private boolean shouldFallbackToAlternativeModel(RestClientResponseException e) {
        int statusCode = e.getStatusCode().value();
        if (statusCode == 404 || statusCode == 429 || e.getStatusCode().is5xxServerError()) {
            return true;
        }

        if (statusCode == 400 || statusCode == 403) {
            String errorMessage = extractGeminiErrorMessage(e).toLowerCase(Locale.ROOT);
            return errorMessage.contains("model")
                    && (errorMessage.contains("not found")
                    || errorMessage.contains("unsupported")
                    || errorMessage.contains("unavailable")
                    || errorMessage.contains("disabled")
                    || errorMessage.contains("invalid"));
        }

        return false;
    }

    private AppException mapGeminiResponseException(String operationLabel, RestClientResponseException e) {
        int statusCode = e.getStatusCode().value();
        if (statusCode == 429) {
            return new AppException("AI provider quota/rate limit reached. Please try again in a minute.", HttpStatus.TOO_MANY_REQUESTS);
        }

        log.warn(
                "Gemini {} failed with status {}: {}",
                operationLabel,
                statusCode,
                extractGeminiErrorMessage(e)
        );
        return new AppException(GENERIC_GEMINI_ERROR_MESSAGE, HttpStatus.BAD_GATEWAY);
    }

    private AppException mapGeminiTransportException(String operationLabel, RestClientException e) {
        log.warn("Gemini {} transport failure: {}", operationLabel, e.getMessage());
        return new AppException(GENERIC_GEMINI_ERROR_MESSAGE, HttpStatus.BAD_GATEWAY);
    }

    private String extractGeminiErrorMessage(RestClientResponseException e) {
        String body = e.getResponseBodyAsString();
        if (!StringUtils.hasText(body)) {
            return e.getMessage();
        }

        String compact = body.replaceAll("\\s+", " ").trim();
        return compact.length() > 300 ? compact.substring(0, 300) + "..." : compact;
    }

    private void sleepWithBackoff(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AppException("Gemini request interrupted.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private ValidatedReceiptImage validateAndReadReceiptImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException("Receipt image is required.", HttpStatus.BAD_REQUEST);
        }

        if (file.getSize() > MAX_RECEIPT_FILE_SIZE_BYTES) {
            throw new AppException("Receipt image too large. Max size is 5MB.", HttpStatus.BAD_REQUEST);
        }

        String contentType = StringUtils.hasText(file.getContentType())
                ? file.getContentType().toLowerCase(Locale.ROOT)
                : "";

        if (!ALLOWED_IMAGE_CONTENT_TYPES.contains(contentType)) {
            throw new AppException("Only JPEG, PNG or WEBP images are supported for receipt scanning.", HttpStatus.BAD_REQUEST);
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new AppException("Could not read uploaded receipt image.", HttpStatus.BAD_REQUEST);
        }

        try (ByteArrayInputStream input = new ByteArrayInputStream(bytes)) {
            BufferedImage image = ImageIO.read(input);
            if (image == null) {
                throw new AppException("Uploaded file is not a valid image.", HttpStatus.BAD_REQUEST);
            }
            if (image.getWidth() > MAX_IMAGE_DIMENSION || image.getHeight() > MAX_IMAGE_DIMENSION) {
                throw new AppException("Receipt image dimensions are too large.", HttpStatus.BAD_REQUEST);
            }
        } catch (IOException e) {
            throw new AppException("Could not validate uploaded receipt image.", HttpStatus.BAD_REQUEST);
        }

        return new ValidatedReceiptImage(contentType, bytes);
    }

    private String extractTextFromGeminiResponse(JsonNode responseBody) {
        if (responseBody == null) {
            throw new AppException("Gemini returned an empty response.", HttpStatus.BAD_GATEWAY);
        }

        JsonNode candidates = responseBody.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new AppException("Gemini could not detect content.", HttpStatus.BAD_GATEWAY);
        }

        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new AppException("Gemini returned an invalid response format.", HttpStatus.BAD_GATEWAY);
        }

        StringBuilder combined = new StringBuilder();
        for (JsonNode part : parts) {
            String text = part.path("text").asText("");
            if (StringUtils.hasText(text)) {
                if (combined.length() > 0) {
                    combined.append("\n");
                }
                combined.append(text);
            }
        }

        if (combined.length() == 0) {
            throw new AppException("Gemini did not return any response text.", HttpStatus.BAD_GATEWAY);
        }

        return combined.toString();
    }

    private String cleanJsonPayload(String value) {
        String cleaned = value.trim();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace("```json", "").replace("```", "").trim();
        }
        return cleaned;
    }

    private String parseAndValidateGeneratedRecipeResponse(String payload, int expectedRecipeCount) {
        JsonNode root;
        try {
            root = objectMapper.readTree(cleanJsonPayload(payload));
        } catch (IOException e) {
            throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
        }

        if (expectedRecipeCount == 1) {
            validateRecipeNode(root, 1);
        } else {
            if (!root.isObject()) {
                throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
            }

            JsonNode recipesNode = root.path("recipes");
            if (!recipesNode.isArray() || recipesNode.size() != expectedRecipeCount) {
                throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
            }

            for (int index = 0; index < recipesNode.size(); index++) {
                validateRecipeNode(recipesNode.get(index), index + 1);
            }
        }

        try {
            return objectMapper.writeValueAsString(root);
        } catch (IOException e) {
            throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
        }
    }

    private void validateRecipeNode(JsonNode recipeNode, int recipeIndex) {
        if (!recipeNode.isObject()) {
            throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
        }

        requireTextField(recipeNode, "name");
        requireTextField(recipeNode, "description");
        requireTextField(recipeNode, "timeToPrepare");

        JsonNode ingredientsNode = recipeNode.path("ingredients");
        if (!ingredientsNode.isArray() || ingredientsNode.isEmpty()) {
            throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
        }
        for (int ingredientIndex = 0; ingredientIndex < ingredientsNode.size(); ingredientIndex++) {
            JsonNode ingredientNode = ingredientsNode.get(ingredientIndex);
            if (!ingredientNode.isObject()) {
                throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
            }
            requireTextField(ingredientNode, "name");
            requireNumericField(ingredientNode, "amount");
            requireTextField(ingredientNode, "unit");
        }

        JsonNode instructionsNode = recipeNode.path("instructions");
        if (!instructionsNode.isArray() || instructionsNode.isEmpty()) {
            throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
        }
        for (JsonNode instructionNode : instructionsNode) {
            if (!instructionNode.isTextual() || !StringUtils.hasText(instructionNode.asText())) {
                throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
            }
        }

        JsonNode nutritionNode = recipeNode.path("nutrition");
        if (!nutritionNode.isObject()) {
            throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
        }
        requireNumericField(nutritionNode, "calories");
        requireNumericField(nutritionNode, "protein");
        requireNumericField(nutritionNode, "carbs");
        requireNumericField(nutritionNode, "fats");
    }

    private void requireTextField(JsonNode node, String fieldName) {
        JsonNode fieldNode = node.get(fieldName);
        if (fieldNode == null || !fieldNode.isTextual() || !StringUtils.hasText(fieldNode.asText())) {
            throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
        }
    }

    private void requireNumericField(JsonNode node, String fieldName) {
        JsonNode fieldNode = node.get(fieldName);
        if (fieldNode == null || !fieldNode.isNumber()) {
            throw new AppException(INVALID_RECIPE_JSON_MESSAGE, HttpStatus.BAD_GATEWAY);
        }
    }

    private List<FridgeIngredientDto> parseReceiptItems(String payload) {
        JsonNode root;
        try {
            root = objectMapper.readTree(payload);
        } catch (IOException e) {
            throw new AppException("Could not parse receipt scan response from Gemini.", HttpStatus.BAD_GATEWAY);
        }

        JsonNode itemsNode = root.isArray() ? root : root.path("items");

        if (!itemsNode.isArray()) {
            throw new AppException("Gemini receipt response missing 'items' array.", HttpStatus.BAD_GATEWAY);
        }

        List<FridgeIngredientDto> parsedItems = new ArrayList<>();
        for (JsonNode itemNode : itemsNode) {
            String name = itemNode.path("name").asText("").trim();
            if (!StringUtils.hasText(name)) {
                continue;
            }

            FridgeIngredientDto dto = new FridgeIngredientDto();
            dto.setName(name);

            JsonNode amountNode = itemNode.get("amount");
            if (amountNode != null && !amountNode.isNull()) {
                dto.setAmount(amountNode.asDouble());
            }

            String unit = itemNode.path("unit").asText("").trim();
            if (StringUtils.hasText(unit)) {
                String normalizedUnit = unit.toUpperCase(Locale.ROOT);
                if (SUPPORTED_UNITS.contains(normalizedUnit)) {
                    dto.setUnit(Unit.valueOf(normalizedUnit).getAbbreviation());
                }
            }

            parsedItems.add(dto);
        }

        return parsedItems;
    }

    private record ValidatedReceiptImage(String mimeType, byte[] bytes) {
    }
}
