import type { Page, Route } from "@playwright/test";

const mockUser = {
  id: 7,
  email: "chef@example.com",
  role: "USER",
  subscriptionPlan: "FREE",
  recipesCreated: 1,
  recipesRemaining: 4,
  recipeCreationLimitReached: false,
  preferences: {
    diet: "NONE",
    diets: [],
    dislikedIngredients: [],
  },
};

const sampleRecipes = [
  {
    id: "101",
    title: "Tomato Basil Pasta",
    name: "Tomato Basil Pasta",
    description: "A bright pantry pasta.",
    ingredients: [{ name: "Tomato", amount: 200, unit: "g" }],
    instructions: ["Boil pasta", "Toss with sauce"],
    timeToPrepare: "25 min",
  },
  {
    id: "102",
    title: "Lemon Herb Rice",
    name: "Lemon Herb Rice",
    description: "Simple rice with herbs.",
    ingredients: [{ name: "Rice", amount: 180, unit: "g" }],
    instructions: ["Cook rice", "Fold through herbs"],
    timeToPrepare: "20 min",
  },
];

const detailedRecipe = {
  id: "101",
  title: "Tomato Basil Pasta",
  name: "Tomato Basil Pasta",
  description: "A bright pantry pasta with a quick tomato sauce.",
  ingredients: [
    { name: "Tomato", amount: 200, unit: "g" },
    { name: "Pasta", amount: 180, unit: "g" },
    { name: "Basil", amount: 12, unit: "g" },
  ],
  instructions: [
    "Boil the pasta until al dente.",
    "Simmer tomatoes with basil.",
    "Toss pasta through the sauce.",
  ],
  timeToPrepare: "25 min",
  nutrition: {
    calories: 520,
    protein: 18,
    carbs: 88,
    fats: 12,
  },
};

let preferences = {
  diet: "NONE",
  diets: ["NONE"],
  dislikedIngredients: ["anchovies"],
};

type FridgeItem = {
  id: number;
  name: string;
  expirationDate: string | null;
  amount?: string | number;
  unit: string;
};

const UNIT_ABBREVIATIONS: Record<string, string> = {
  GRAMS: "g",
  KILOGRAMS: "kg",
  MILLILITERS: "ml",
  LITERS: "l",
  PIECES: "pcs",
};

const normalizeFridgeUnit = (unit: unknown) => {
  const unitValue = String(unit ?? "").trim();
  return UNIT_ABBREVIATIONS[unitValue] ?? unitValue;
};

const parseFridgeAmount = (amount: string | number | undefined) => {
  if (amount === undefined || amount === "") {
    return null;
  }

  const parsedAmount =
    typeof amount === "number" ? amount : Number.parseFloat(amount);
  return Number.isFinite(parsedAmount) ? parsedAmount : null;
};

const mergeFridgeAmounts = (
  firstAmount: string | number | undefined,
  secondAmount: string | number | undefined,
) => {
  const firstParsedAmount = parseFridgeAmount(firstAmount);
  const secondParsedAmount = parseFridgeAmount(secondAmount);

  if (firstParsedAmount === null) {
    return secondAmount;
  }

  if (secondParsedAmount === null) {
    return firstAmount;
  }

  return String(firstParsedAmount + secondParsedAmount);
};

const fulfillJson = async (
  route: Route,
  body: unknown,
  status: number = 200,
) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
};

const getEndpoint = (route: Route) => {
  const requestUrl = new URL(route.request().url());
  return requestUrl.pathname.replace(/^\/api\/?/, "");
};

export const mockGuestApi = async (page: Page) => {
  await page.route("**/api/**", async (route) => {
    const endpoint = getEndpoint(route);
    const method = route.request().method();

    if (endpoint === "me" || endpoint === "refresh") {
      await fulfillJson(route, { message: "Unauthorized" }, 401);
      return;
    }

    if (method === "GET" && endpoint.startsWith("getAllRecipes")) {
      await fulfillJson(route, {
        content: sampleRecipes,
        totalPages: 1,
      });
      return;
    }

    if (method === "GET" && endpoint.startsWith("getRecipe/101")) {
      await fulfillJson(route, detailedRecipe);
      return;
    }

    await fulfillJson(route, { message: `Unhandled endpoint: ${endpoint}` }, 404);
  });
};

const fulfillAuthenticatedCommonEndpoint = async (
  route: Route,
  endpoint: string,
  method: string,
): Promise<boolean> => {
  if (endpoint === "me") {
    await fulfillJson(route, { ...mockUser, preferences });
    return true;
  }

  if (method === "GET" && endpoint === "user/getDiets") {
    await fulfillJson(route, [
      "NONE",
      "VEGETARIAN",
      "VEGAN",
      "GLUTEN_FREE",
      "HIGH_PROTEIN",
    ]);
    return true;
  }

  if (method === "GET" && endpoint === "user/getPreferences") {
    await fulfillJson(route, preferences);
    return true;
  }

  if (method === "POST" && endpoint === "user/changeDiets") {
    const selectedDiets = route.request().postDataJSON() as string[];
    preferences = {
      ...preferences,
      diet: selectedDiets[0] ?? "NONE",
      diets: selectedDiets,
    };
    await fulfillJson(route, preferences);
    return true;
  }

  if (method === "POST" && endpoint === "user/addDislikedIngredient") {
    const ingredient = String(route.request().postData() ?? "").trim();
    preferences = {
      ...preferences,
      dislikedIngredients: [
        ...preferences.dislikedIngredients,
        ingredient.toLowerCase(),
      ],
    };
    await fulfillJson(route, preferences);
    return true;
  }

  return false;
};

export const mockLoginApi = async (page: Page) => {
  let authenticated = false;

  await page.route("**/api/**", async (route) => {
    const endpoint = getEndpoint(route);
    const method = route.request().method();

    if (method === "POST" && endpoint === "login") {
      authenticated = true;
      await fulfillJson(route, mockUser);
      return;
    }

    if (endpoint === "me") {
      await fulfillJson(
        route,
        authenticated ? mockUser : { message: "Unauthorized" },
        authenticated ? 200 : 401,
      );
      return;
    }

    if (endpoint === "refresh") {
      await fulfillJson(route, { message: "Unauthorized" }, 401);
      return;
    }

    await fulfillJson(route, { message: `Unhandled endpoint: ${endpoint}` }, 404);
  });
};

export const mockRegisterApi = async (page: Page) => {
  let authenticated = false;
  preferences = {
    diet: "NONE",
    diets: ["NONE"],
    dislikedIngredients: [],
  };

  await page.route("**/api/**", async (route) => {
    const endpoint = getEndpoint(route);
    const method = route.request().method();

    if (method === "POST" && endpoint === "register") {
      authenticated = true;
      await fulfillJson(route, { ...mockUser, preferences });
      return;
    }

    if (authenticated) {
      const handled = await fulfillAuthenticatedCommonEndpoint(
        route,
        endpoint,
        method,
      );
      if (handled) {
        return;
      }
    }

    if (endpoint === "me" || endpoint === "refresh") {
      await fulfillJson(route, { message: "Unauthorized" }, 401);
      return;
    }

    await fulfillJson(route, { message: `Unhandled endpoint: ${endpoint}` }, 404);
  });
};

export const mockAuthenticatedRecipesApi = async (page: Page) => {
  await page.route("**/api/**", async (route) => {
    const endpoint = getEndpoint(route);
    const method = route.request().method();

    if (
      await fulfillAuthenticatedCommonEndpoint(route, endpoint, method)
    ) {
      return;
    }

    if (method === "GET" && endpoint.startsWith("getUserRecipes/7")) {
      await fulfillJson(route, {
        content: [sampleRecipes[0]],
        totalPages: 1,
      });
      return;
    }

    if (method === "GET" && endpoint.startsWith("searchRecipes/lemon")) {
      await fulfillJson(route, {
        content: [sampleRecipes[1]],
        totalPages: 1,
      });
      return;
    }

    if (method === "GET" && endpoint.startsWith("getRecipe/101")) {
      await fulfillJson(route, detailedRecipe);
      return;
    }

    await fulfillJson(route, { message: `Unhandled endpoint: ${endpoint}` }, 404);
  });
};

export const mockAuthenticatedFridgeApi = async (
  page: Page,
  initialFridgeItems?: FridgeItem[],
) => {
  let fridgeItems: FridgeItem[] = initialFridgeItems ?? [
    {
      id: 1,
      name: "Eggs",
      expirationDate: "31-12-2099",
      amount: "6",
      unit: "pcs",
    },
  ];

  await page.route("**/api/**", async (route) => {
    const endpoint = getEndpoint(route);
    const method = route.request().method();

    if (
      await fulfillAuthenticatedCommonEndpoint(route, endpoint, method)
    ) {
      return;
    }

    if (method === "GET" && endpoint === "getFridgeIngredients") {
      await fulfillJson(route, fridgeItems);
      return;
    }

    if (method === "POST" && endpoint === "addFridgeIngredient") {
      const payload = route.request().postDataJSON() as Partial<FridgeItem>;
      fridgeItems.push({
        id: Math.max(0, ...fridgeItems.map((item) => item.id)) + 1,
        name: String(payload.name ?? "Unknown ingredient"),
        expirationDate:
          typeof payload.expirationDate === "string"
            ? payload.expirationDate
            : null,
        amount: payload.amount,
        unit: normalizeFridgeUnit(payload.unit),
      });
      await fulfillJson(route, { message: "Ingredient added" });
      return;
    }

    if (method === "POST" && endpoint.startsWith("updateFridgeIngredient/")) {
      const id = Number(endpoint.replace("updateFridgeIngredient/", ""));
      const payload = route.request().postDataJSON() as Partial<FridgeItem>;
      const itemIndex = fridgeItems.findIndex((item) => item.id === id);

      if (itemIndex === -1) {
        await fulfillJson(route, { message: "Fridge ingredient not found" }, 404);
        return;
      }

      const updatedItem: FridgeItem = {
        ...fridgeItems[itemIndex],
        name: String(payload.name ?? fridgeItems[itemIndex].name).trim(),
        expirationDate:
          typeof payload.expirationDate === "string"
            ? payload.expirationDate
            : null,
        amount: payload.amount,
        unit: normalizeFridgeUnit(payload.unit),
      };

      if (parseFridgeAmount(updatedItem.amount) === 0) {
        fridgeItems = fridgeItems.filter((item) => item.id !== id);
        await fulfillJson(route, {});
        return;
      }

      const mergeTarget = fridgeItems.find(
        (item) =>
          item.id !== id &&
          item.name.toLowerCase() === updatedItem.name.toLowerCase() &&
          item.expirationDate === updatedItem.expirationDate &&
          item.unit === updatedItem.unit,
      );

      if (mergeTarget) {
        mergeTarget.amount = mergeFridgeAmounts(
          mergeTarget.amount,
          updatedItem.amount,
        );
        fridgeItems = fridgeItems.filter((item) => item.id !== id);
        await fulfillJson(route, mergeTarget);
        return;
      }

      fridgeItems[itemIndex] = updatedItem;
      await fulfillJson(route, updatedItem);
      return;
    }

    if (method === "DELETE" && endpoint.startsWith("deleteFridgeIngredient/")) {
      const id = Number(endpoint.replace("deleteFridgeIngredient/", ""));
      fridgeItems = fridgeItems.filter((item) => item.id !== id);
      await fulfillJson(route, {});
      return;
    }

    await fulfillJson(route, { message: `Unhandled endpoint: ${endpoint}` }, 404);
  });
};

export const mockProfileApi = async (page: Page) => {
  preferences = {
    diet: "NONE",
    diets: ["NONE"],
    dislikedIngredients: ["anchovies"],
  };

  await page.route("**/api/**", async (route) => {
    const endpoint = getEndpoint(route);
    const method = route.request().method();

    if (
      await fulfillAuthenticatedCommonEndpoint(route, endpoint, method)
    ) {
      return;
    }

    await fulfillJson(route, { message: `Unhandled endpoint: ${endpoint}` }, 404);
  });
};

export const mockShoppingListApi = async (page: Page) => {
  let shoppingItems = [
    {
      id: "remote-1",
      name: "Tomatoes",
      amount: 3,
      unit: "pcs",
      checked: false,
      createdAt: "2026-05-15T09:00:00.000Z",
    },
  ];

  await page.route("**/api/**", async (route) => {
    const endpoint = getEndpoint(route);
    const method = route.request().method();

    if (
      await fulfillAuthenticatedCommonEndpoint(route, endpoint, method)
    ) {
      return;
    }

    if (method === "GET" && endpoint === "shoppingList") {
      await fulfillJson(route, shoppingItems);
      return;
    }

    if (method === "PUT" && endpoint === "shoppingList") {
      const payload = route.request().postDataJSON() as {
        items?: typeof shoppingItems;
      };
      shoppingItems = Array.isArray(payload.items) ? payload.items : [];
      await fulfillJson(route, shoppingItems);
      return;
    }

    await fulfillJson(route, { message: `Unhandled endpoint: ${endpoint}` }, 404);
  });
};
