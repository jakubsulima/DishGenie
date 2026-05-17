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
