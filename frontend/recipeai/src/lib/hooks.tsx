import axios, { AxiosResponse } from "axios";
import { API_URL, TIMEOUT } from "./constants.tsx";

const formOfPrompt =
  ' Act as a professional culinary database architect and recommendation engine. Return ONLY a single valid JSON object following this exact schema: { "name": string, "description": string, "timeToPrepare": string, "ingredients": [{"name": string, "amount": number, "unit": string}], "instructions": [string], "nutrition": { "calories": number, "protein": number, "carbs": number, "fats": number } }. Enforce user filters from the request text (meal type, cuisine, time constraint, and additional notes). Include 8-14 ingredients with realistic amounts for 2 servings. Use strict metric units (g, ml, kg) or whole counts. Provide 6-9 technical instructions with sensory cues and clear time/temperature markers. Avoid vague steps like \'cook until done\'. Ensure nutrition values are internally consistent with the listed ingredients. Do not include markdown or conversational text.';
const batchFormOfPrompt =
  ' Act as a professional culinary database architect and recommendation engine. Return ONLY a single valid JSON object following this exact schema: { "recipes": [{ "name": string, "description": string, "timeToPrepare": string, "ingredients": [{"name": string, "amount": number, "unit": string}], "instructions": [string], "nutrition": { "calories": number, "protein": number, "carbs": number, "fats": number } }] }. Enforce user filters from the request text (meal type, cuisine, time constraint, and additional notes). All generated recipes must match those filters. Create meaningful diversity across recipes by varying core protein category, cooking technique, and flavor profile while staying plausible. For EACH recipe: include 8-14 ingredients with realistic amounts for 2 servings, use strict metric units (g, ml, kg) or whole counts, and provide 6-9 technical instructions with sensory cues and clear time/temperature markers. Ensure nutrition values are internally consistent with the listed ingredients. Do not include markdown or conversational text.';

type ApiRecord = Record<string, unknown>;

interface AppError extends Error {
  status?: number;
  isNetworkError?: boolean;
  isContentTypeError?: boolean;
}

const asRecord = (value: unknown): ApiRecord | null => {
  if (value && typeof value === "object") {
    return value as ApiRecord;
  }
  return null;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
};

const isSensitiveAiErrorMessage = (message: string): boolean => {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("api key not valid") ||
    normalizedMessage.includes("api_key_invalid") ||
    normalizedMessage.includes("generativelanguage.googleapis.com") ||
    normalizedMessage.includes("googleapis.com") ||
    normalizedMessage.includes("error creating recipe") ||
    normalizedMessage.includes("invalid_argument")
  );
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return undefined;
};

const hasContentTypeError = (error: unknown): boolean => {
  return Boolean(
    error &&
    typeof error === "object" &&
    "isContentTypeError" in error &&
    (error as { isContentTypeError?: unknown }).isContentTypeError,
  );
};

const inFlightRecipeRequests = new Map<string, Promise<unknown>>();

const buildRecipePrompt = (
  prompt: string,
  productsFridge: string[],
  requestedCount: number,
) => {
  const promptFormat = requestedCount > 1 ? batchFormOfPrompt : formOfPrompt;
  const countInstruction =
    requestedCount > 1
      ? ` Return exactly ${requestedCount} recipes in the recipes array.`
      : " Return exactly 1 recipe object.";
  return (
    prompt +
    promptFormat +
    countInstruction +
    (productsFridge.length > 0
      ? " Prioritize using these products for this recipe: " +
        productsFridge.join(", ")
      : "")
  );
};

const requestRecipeGeneration = async (
  prompt: string,
  productsFridge: string[],
  requestedCount: number,
  signal?: AbortSignal,
): Promise<unknown> => {
  const fullPrompt = buildRecipePrompt(prompt, productsFridge, requestedCount);
  const result = await axios.post(
    `${API_URL}generateRecipe`,
    {
      fullPrompt,
      count: requestedCount,
    },
    { signal },
  );

  return result.data;
};

const buildGenerationKey = (
  prompt: string,
  productsFridge: string[],
  requestedCount: number,
) => `${requestedCount}::${prompt}::${productsFridge.join("|")}`;

export const generateRecipe = async function (
  prompt: string,
  productsFridge: string[],
  signal?: AbortSignal,
  count: number = 1,
) {
  try {
    const normalizedCount = Math.max(1, Math.min(5, Math.floor(count)));

    // Requests controlled by AbortController should never share promises,
    // otherwise a previously aborted request can cancel a fresh one.
    if (signal) {
      return await requestRecipeGeneration(
        prompt,
        productsFridge,
        normalizedCount,
        signal,
      );
    }

    const requestKey = buildGenerationKey(
      prompt,
      productsFridge,
      normalizedCount,
    );

    if (!inFlightRecipeRequests.has(requestKey)) {
      const requestPromise = requestRecipeGeneration(
        prompt,
        productsFridge,
        normalizedCount,
        signal,
      ).finally(() => {
        inFlightRecipeRequests.delete(requestKey);
      });

      inFlightRecipeRequests.set(requestKey, requestPromise);
    }

    return await inFlightRecipeRequests.get(requestKey)!;
  } catch (error: unknown) {
    if (axios.isCancel(error)) {
      throw new DOMException("Recipe generation cancelled", "AbortError");
    }

    const message = axios.isAxiosError(error)
      ? typeof error.response?.data === "string" &&
        error.response.data.trim() !== ""
        ? error.response.data
        : (() => {
            const data = asRecord(error.response?.data);
            const nestedMessage = data?.message;
            return typeof nestedMessage === "string" &&
              nestedMessage.trim() !== ""
              ? nestedMessage
              : error.message;
          })()
      : error instanceof Error
        ? error.message
        : "Unknown AI error";

    throw new Error(`AI Generation Error: ${message}`);
  }
};

export const cleanAiJsonString = (response: unknown): string => {
  let jsonString =
    typeof response === "string"
      ? response.replace(/```json|```/g, "").trim()
      : JSON.stringify(response);
  jsonString = jsonString.replace(/,\s*([}\]])/g, "$1");
  jsonString = jsonString.replace(
    /"timeToPrepare\(string\)"/g,
    '"timeToPrepare"',
  );
  return jsonString;
};

export const lookupProductByBarcode = async (
  barcode: string,
): Promise<string | null> => {
  const normalized = barcode.trim();
  if (!normalized) {
    return null;
  }

  const response = await axios.get(
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
      normalized,
    )}.json`,
    {
      withCredentials: false,
    },
  );

  const responseData = asRecord(response.data);
  const product = asRecord(responseData?.product);
  const productName = product?.product_name;
  const productNameEn = product?.product_name_en;
  const genericName = product?.generic_name;

  const name =
    (typeof productName === "string" ? productName.trim() : "") ||
    (typeof productNameEn === "string" ? productNameEn.trim() : "") ||
    (typeof genericName === "string" ? genericName.trim() : "") ||
    null;

  return name;
};

axios.defaults.headers.common["Content-Type"] = "application/json";
axios.defaults.withCredentials = true;

let refreshTokenRequest: Promise<void> | null = null;

const refreshAccessToken = async () => {
  if (!refreshTokenRequest) {
    refreshTokenRequest = axios
      .post(`${API_URL}refresh`, null, { withCredentials: true })
      .then(() => undefined)
      .finally(() => {
        refreshTokenRequest = null;
      });
  }

  return refreshTokenRequest;
};

// Add axios interceptor to handle token refresh automatically
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url ?? "");
    const isRefreshRequest = requestUrl.includes("/refresh");
    const shouldAttemptTokenRefresh =
      localStorage.getItem("isLoggedIn") === "true";

    // If error is 401 and we haven't retried yet
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshRequest &&
      shouldAttemptTokenRefresh
    ) {
      originalRequest._retry = true;

      try {
        await refreshAccessToken();

        // Retry the original request with new token
        return axios(originalRequest);
      } catch (refreshError: unknown) {
        localStorage.removeItem("isLoggedIn");
        window.dispatchEvent(new Event("auth:session-expired"));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export const apiClient = async function (
  url: string,
  uploadData: boolean = false,
  body: unknown = null,
) {
  const normalizedUrl = String(url ?? "");
  const authNoiseEndpoints = [
    "me",
    "refresh",
    "user/getPreferences",
    "user/getDiets",
    "getFridgeIngredients",
    "shoppingList",
  ];
  const isAuthNoiseEndpoint = authNoiseEndpoints.some((endpoint) =>
    normalizedUrl.includes(endpoint),
  );

  try {
    const isPlainString = typeof body === "string";
    const fetchOperation: Promise<AxiosResponse<unknown>> = uploadData
      ? axios.post(API_URL + url, body, {
          headers: isPlainString
            ? { "Content-Type": "text/plain" }
            : { "Content-Type": "application/json" },
        })
      : axios.get(API_URL + url, {
          timeout: TIMEOUT * 1000,
        });

    const res = (await Promise.race([
      fetchOperation,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Request timed out after ${TIMEOUT} seconds`)),
          TIMEOUT * 1000,
        ),
      ),
    ])) as AxiosResponse<unknown>;

    const contentType = String(res.headers["content-type"] ?? "");
    if (contentType.includes("text/html")) {
      const htmlError = new Error(
        "Received HTML instead of JSON. Backend endpoint may be incorrect or down.",
      ) as AppError;
      htmlError.isContentTypeError = true;
      if (isAuthNoiseEndpoint) {
        htmlError.status = 401;
      }
      throw htmlError;
    }

    return res.data;
  } catch (error: unknown) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : getErrorStatus(error);
    const isExpectedAuthNoise =
      ((status === 401 || status === 400) && isAuthNoiseEndpoint) ||
      (hasContentTypeError(error) && isAuthNoiseEndpoint);

    if (!isExpectedAuthNoise) {
      if (axios.isAxiosError(error)) {
        console.error(
          "AJAX Error Details:",
          error.response
            ? { status: error.response.status, data: error.response.data }
            : error.message,
        );
      } else {
        console.error(
          "AJAX Error Details:",
          getErrorMessage(error, "Unknown error"),
        );
      }
    }

    let finalError: AppError;

    if (axios.isAxiosError(error)) {
      if (error.response) {
        const responseStatus = error.response.status;
        let message = `Server error (status: ${responseStatus}`;
        const responseData = error.response.data;

        if (typeof responseData === "string" && responseData.trim() !== "") {
          message = responseData;
        } else {
          const data = asRecord(responseData);
          const nestedMessage = data?.message;
          if (
            typeof nestedMessage === "string" &&
            nestedMessage.trim() !== ""
          ) {
            message = nestedMessage;
          }
        }

        finalError = new Error(message || `Server error (${responseStatus})`);
        finalError.status = responseStatus;
      } else if (error.request) {
        finalError = new Error(
          "No response from server. Check network or server availability.",
        );
        finalError.isNetworkError = true;
      } else {
        finalError = new Error(`Request error: ${error.message}`);
      }
    } else if (error instanceof Error) {
      const cleanedMessage = error.message
        .replace(/^AI Generation Error:\s*/i, "")
        .trim();
      if (cleanedMessage && isSensitiveAiErrorMessage(cleanedMessage)) {
        finalError = new Error(
          "AI Generation Error: Recipe generation service is temporarily unavailable. Please try again later.",
        ) as AppError;
      } else {
        finalError = error as AppError;
      }
    } else {
      finalError = new Error(
        "An unknown AJAX error occurred: " + String(error),
      );
    }

    throw finalError;
  }
};

export const deleteClient = async function (url: string) {
  try {
    const res = await axios.delete(API_URL + url);
    return res.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Delete Error:",
        error.response
          ? { status: error.response.status, data: error.response.data }
          : error.message,
      );

      if (error.response) {
        const status = error.response.status;
        const data = asRecord(error.response.data);
        const nestedMessage = data?.message;
        const message =
          typeof nestedMessage === "string"
            ? nestedMessage
            : `Server error (status: ${status}`;
        const finalError = new Error(message) as AppError;
        finalError.status = status;
        throw finalError;
      }
    }

    throw new Error(getErrorMessage(error, "Unknown delete error"));
  }
};

export const putClient = async function (url: string, body: unknown = null) {
  try {
    const res = await axios.put(API_URL + url, body, {
      headers: { "Content-Type": "application/json" },
    });
    return res.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Put Error:",
        error.response
          ? { status: error.response.status, data: error.response.data }
          : error.message,
      );

      if (error.response) {
        const status = error.response.status;
        const data = asRecord(error.response.data);
        const nestedMessage = data?.message;
        const message =
          typeof nestedMessage === "string"
            ? nestedMessage
            : `Server error (status: ${status}`;
        const finalError = new Error(message) as AppError;
        finalError.status = status;
        throw finalError;
      }
    }

    throw new Error(getErrorMessage(error, "Unknown put error"));
  }
};

export const formatDateForBackend = (dateString: string): string => {
  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return "";
  }

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const isValidNumber = (value: string): boolean => {
  if (value.trim() === "") return false;

  const numberRegex = /^[0-9]*\.?[0-9]+$/;

  if (!numberRegex.test(value.trim())) return false;

  const num = parseFloat(value.trim());
  return !isNaN(num) && num > 0;
};

export const hasAmountError = (amount: string): boolean => {
  return amount.trim() !== "" && !isValidNumber(amount);
};
