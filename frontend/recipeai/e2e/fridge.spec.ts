import { expect, test } from "@playwright/test";
import { mockAuthenticatedFridgeApi } from "./apiMocks";

test("authenticated user can add an ingredient to the fridge", async ({
  page,
}) => {
  await mockAuthenticatedFridgeApi(page);
  await page.goto("/Fridge");

  await expect(page.getByRole("heading", { name: "My Fridge" })).toBeVisible();
  await expect(page.getByText("Eggs")).toBeVisible();

  await page.getByRole("button", { name: /add to fridge/i }).click();
  await page.getByPlaceholder("e.g., Tomatoes").fill("Bananas");
  await page.getByRole("button", { name: "Add Item" }).click();

  await expect(page.getByText("Bananas")).toBeVisible();
  await expect(page.getByText("2 items")).toBeVisible();
});
