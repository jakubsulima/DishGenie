import { expect, test } from "@playwright/test";
import { mockShoppingListApi } from "./apiMocks";

test("user can add, check, and clear shopping list items", async ({ page }) => {
  await mockShoppingListApi(page);
  await page.goto("/ShoppingList");

  await expect(
    page.getByRole("heading", { name: "Shopping List" }),
  ).toBeVisible();
  await expect(page.getByText("Tomatoes - 3 pcs")).toBeVisible();

  await page.getByPlaceholder("e.g. Tomatoes").fill("Basil");
  await page.getByRole("button", { name: "Add" }).click();

  await expect(page.getByText("Basil")).toBeVisible();
  await expect(page.getByText("2 left")).toBeVisible();

  await page.getByLabel("Check all items").check();
  await expect(page.getByText("0 left")).toBeVisible();
  await expect(page.getByText("2 completed")).toBeVisible();

  await page.getByRole("button", { name: /clear checked/i }).click();
  await expect(page.getByText("Your shopping list is empty.")).toBeVisible();
});
