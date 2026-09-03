import { expect, test } from "@playwright/test";
import { mockAuthenticatedRecipesApi, mockGuestApi } from "./apiMocks";

test("public recipe detail page renders ingredients, steps, and nutrition", async ({
  page,
}) => {
  await mockGuestApi(page);
  await page.goto("/Recipe/101");

  await expect(
    page.getByRole("heading", { name: "Tomato Basil Pasta" }),
  ).toBeVisible();
  await expect(page.getByText("A bright pantry pasta")).toBeVisible();
  await expect(page.getByText("3 ingredients")).toBeVisible();
  await expect(page.getByText("Boil the pasta until al dente.")).toBeVisible();
  await expect(page.getByText("520 kcal")).toBeVisible();
});

test("guest is prompted to log in before generating a shopping list from a public recipe", async ({
  page,
}) => {
  await mockGuestApi(page);
  await page.goto("/Recipe/101");

  await page
    .getByRole("button", { name: "Log In to Generate Shopping List" })
    .click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("authenticated user can generate a shopping list from a recipe", async ({
  page,
}) => {
  await mockAuthenticatedRecipesApi(page);
  await page.goto("/Recipe/101");

  const previewRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith("/api/v2/shopping-list/preview-from-recipe"),
  );
  await page.getByRole("button", { name: "Generate Shopping List" }).click();
  expect((await previewRequest).postDataJSON()).toEqual({
    recipeId: 101,
    targetServings: 2,
    excludeStaples: false,
  });

  await expect(page).toHaveURL(/\/ShoppingList$/);
  await expect(
    page.getByRole("heading", { name: "Shopping List" }),
  ).toBeVisible();
  await expect(page.getByText("Pasta - 180 g")).toBeVisible();
});

test("authenticated user can mark a recipe cooked and update matching fridge items", async ({
  page,
}) => {
  await mockAuthenticatedRecipesApi(page);
  await page.goto("/Recipe/101");

  const operationRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith("/api/v2/fridge/operations"),
  );
  await page.getByRole("button", { name: /Cooked/i }).click();

  expect((await operationRequest).postDataJSON()).toMatchObject({
    source: "COOKED_RECIPE",
    sourceReference: "101",
    changes: [
      { type: "DECREMENT", fridgeItemId: 21, amount: 200 },
      { type: "DECREMENT", fridgeItemId: 22, amount: 12 },
    ],
  });
  await expect(page.getByText("Fridge updated after cooking.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cooked ✓" })).toBeDisabled();
});

test("authenticated user can search their saved recipes", async ({ page }) => {
  await mockAuthenticatedRecipesApi(page);
  await page.goto("/Recipes");

  await expect(page.getByRole("heading", { name: "My Recipes" })).toBeVisible();
  await expect(page.getByText("Tomato Basil Pasta")).toBeVisible();

  await page.getByPlaceholder("Search recipes by name...").fill("lemon");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page.getByText('Searching for: "lemon"')).toBeVisible();
  await expect(page.getByText("Lemon Herb Rice")).toBeVisible();
  await expect(page.getByText("Tomato Basil Pasta")).toBeHidden();
});
