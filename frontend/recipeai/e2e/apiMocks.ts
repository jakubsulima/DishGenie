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

const markBrowserAsAuthenticated = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("isLoggedIn", "true");
    window.localStorage.setItem("dishGenie.locale", "en");
  });
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

const generatedDinnerIdea = {
  name: "Saved Dinner Idea Bowl",
  description: "A practical dinner generated from the guest's saved homepage choices.",
  ingredients: [
    { name: "Eggs", amount: 2, unit: "pcs" },
    { name: "Rice", amount: 180, unit: "g" },
    { name: "Spinach", amount: 80, unit: "g" },
  ],
  instructions: [
    "Cook the rice until tender.",
    "Wilt spinach in a hot pan.",
    "Add eggs and fold everything together.",
  ],
  timeToPrepare: "20 min",
  nutrition: {
    calories: 520,
    protein: 24,
    carbs: 68,
    fats: 16,
  },
};

const generatedDinnerOptions = {
  recipes: [
    generatedDinnerIdea,
    {
      name: "Roasted Rice Skillet",
      description: "A slower, crisp-edged dinner with deeper roasted flavor.",
      ingredients: [
        { name: "Rice", amount: 180, unit: "g" },
        { name: "Eggs", amount: 2, unit: "pcs" },
        { name: "Onion", amount: 1, unit: "pcs" },
        { name: "Paprika", amount: 5, unit: "g" },
      ],
      instructions: [
        "Warm rice in a skillet until lightly crisp.",
        "Add onion and paprika.",
        "Fold in eggs and finish until set.",
      ],
      timeToPrepare: "30 min",
      nutrition: {
        calories: 640,
        protein: 28,
        carbs: 82,
        fats: 20,
      },
    },
    {
      name: "Protein Spinach Egg Rice",
      description: "A higher-protein bowl that keeps the same ingredients filling.",
      ingredients: [
        { name: "Eggs", amount: 4, unit: "pcs" },
        { name: "Rice", amount: 160, unit: "g" },
        { name: "Spinach", amount: 100, unit: "g" },
        { name: "Yogurt", amount: 80, unit: "g" },
      ],
      instructions: [
        "Cook eggs until softly set.",
        "Fold spinach into warm rice.",
        "Top with yogurt and serve hot.",
      ],
      timeToPrepare: "25 min",
      nutrition: {
        calories: 590,
        protein: 38,
        carbs: 62,
        fats: 18,
      },
    },
  ],
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

const fulfillCsrfEndpoint = async (route: Route, endpoint: string) => {
  if (endpoint !== "csrf") {
    return false;
  }

  await fulfillJson(route, {
    headerName: "X-XSRF-TOKEN",
    parameterName: "_csrf",
    token: "test-csrf-token",
  });
  return true;
};

export const mockGuestApi = async (page: Page) => {
  await page.route("**/api/**", async (route) => {
    const endpoint = getEndpoint(route);
    const method = route.request().method();

    if (await fulfillCsrfEndpoint(route, endpoint)) {
      return;
    }

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
  if (await fulfillCsrfEndpoint(route, endpoint)) {
    return true;
  }

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

    if (await fulfillCsrfEndpoint(route, endpoint)) {
      return;
    }

    if (method === "POST" && endpoint === "login") {
      authenticated = true;
      await fulfillJson(route, mockUser);
      return;
    }

    if (method === "POST" && endpoint === "logout") {
      authenticated = false;
      await fulfillJson(route, {});
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

    if (authenticated) {
      if (method === "GET" && endpoint === "getFridgeIngredients") {
        await fulfillJson(route, []);
        return;
      }

      if (method === "POST" && endpoint === "generateRecipe") {
        await fulfillJson(route, generatedDinnerOptions);
        return;
      }
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

    if (await fulfillCsrfEndpoint(route, endpoint)) {
      return;
    }

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

      if (method === "GET" && endpoint === "getFridgeIngredients") {
        await fulfillJson(route, []);
        return;
      }

      if (method === "POST" && endpoint === "generateRecipe") {
        await fulfillJson(route, generatedDinnerOptions);
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
  await markBrowserAsAuthenticated(page);
  let shoppingItems = [
    {
      id: "generated-1",
      name: "Pasta",
      amount: 180,
      unit: "g",
      checked: false,
      createdAt: "2026-05-17T09:00:00.000Z",
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

    if (method === "POST" && endpoint === "shoppingList/generate-from-recipe") {
      await fulfillJson(route, [
        { name: "Pasta", amount: 180, unit: "g" },
      ]);
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

export const mockAuthenticatedFridgeApi = async (
  page: Page,
  initialFridgeItems?: FridgeItem[],
) => {
  await markBrowserAsAuthenticated(page);
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
  await markBrowserAsAuthenticated(page);
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

export const mockPromoJourneyApi = async (page: Page) => {
  await markBrowserAsAuthenticated(page);
  preferences = {
    diet: "NONE",
    diets: ["NONE"],
    dislikedIngredients: ["anchovies"],
  };

  const fridgeItems: FridgeItem[] = [
    {
      id: 1,
      name: "Spinach",
      expirationDate: null,
      amount: "1",
      unit: "bag",
    },
    {
      id: 2,
      name: "Chicken breast",
      expirationDate: null,
      amount: "2",
      unit: "pcs",
    },
    {
      id: 3,
      name: "Coconut milk",
      expirationDate: null,
      amount: "400",
      unit: "ml",
    },
    {
      id: 4,
      name: "Rice",
      expirationDate: null,
      amount: "500",
      unit: "g",
    },
  ];

  const generatedRecipe = {
    name: "Creamy Coconut Chicken Bowl",
    description:
      "A quick high-protein dinner with coconut sauce, greens, and rice.",
    timeToPrepare: "28 min",
    ingredients: [
      { name: "Chicken breast", amount: 320, unit: "g" },
      { name: "Spinach", amount: 120, unit: "g" },
      { name: "Coconut milk", amount: 240, unit: "ml" },
      { name: "Rice", amount: 180, unit: "g" },
      { name: "Garlic", amount: 12, unit: "g" },
      { name: "Lime", amount: 1, unit: "pcs" },
    ],
    instructions: [
      "Cook rice until tender and fluffy.",
      "Sear chicken until golden and cooked through.",
      "Simmer garlic with coconut milk and reduce slightly.",
      "Fold spinach into the sauce until just wilted.",
      "Finish with lime and serve over rice.",
    ],
    nutrition: {
      calories: 610,
      protein: 41,
      carbs: 54,
      fats: 24,
    },
  };

  let shoppingItems = [
    {
      id: "promo-shopping-1",
      name: "Chicken breast",
      amount: 320,
      unit: "g",
      checked: false,
      createdAt: "2026-05-17T09:00:00.000Z",
    },
    {
      id: "promo-shopping-2",
      name: "Spinach",
      amount: 120,
      unit: "g",
      checked: false,
      createdAt: "2026-05-17T09:01:00.000Z",
    },
    {
      id: "promo-shopping-3",
      name: "Coconut milk",
      amount: 240,
      unit: "ml",
      checked: false,
      createdAt: "2026-05-17T09:02:00.000Z",
    },
  ];

  const savedRecipes = [{ ...generatedRecipe, id: "501", title: generatedRecipe.name }];

  await page.route("**/api/**", async (route) => {
    const endpoint = getEndpoint(route);
    const method = route.request().method();

    if (await fulfillAuthenticatedCommonEndpoint(route, endpoint, method)) {
      return;
    }

    if (method === "GET" && endpoint === "getFridgeIngredients") {
      await fulfillJson(route, fridgeItems);
      return;
    }

    if (method === "POST" && endpoint === "generateRecipe") {
      await fulfillJson(route, generatedRecipe);
      return;
    }

    if (method === "POST" && endpoint === "addRecipe") {
      await fulfillJson(route, { id: "501", message: "Recipe saved" });
      return;
    }

    if (method === "GET" && endpoint.startsWith("getUserRecipes/7")) {
      await fulfillJson(route, {
        content: savedRecipes,
        totalPages: 1,
      });
      return;
    }

    if (method === "POST" && endpoint === "shoppingList/generate-from-recipe") {
      await fulfillJson(
        route,
        shoppingItems.map(({ name, amount, unit }) => ({ name, amount, unit })),
      );
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

export const mockShoppingListApi = async (page: Page) => {
  await markBrowserAsAuthenticated(page);
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
