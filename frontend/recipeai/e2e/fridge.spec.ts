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

test("user can edit fridge item fields inline on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuthenticatedFridgeApi(page, [
    {
      id: 3,
      name: "Yogurt",
      expirationDate: "20-05-2026",
      amount: "1",
      unit: "l",
    },
  ]);

  await page.goto("/Fridge");

  await page.getByRole("button", { name: /edit yogurt/i }).click();

  const amountInput = page.getByLabel("Amount");
  const unitButton = page.getByRole("button", { name: "Unit l" });
  const expirationInput = page.getByLabel("Expiration");

  await expect(amountInput).toBeVisible();
  await expect(unitButton).toBeVisible();
  await expect(expirationInput).toBeVisible();

  const [amountBox, unitBox, expirationBox] = await Promise.all([
    amountInput.boundingBox(),
    unitButton.boundingBox(),
    expirationInput.boundingBox(),
  ]);

  expect(amountBox).not.toBeNull();
  expect(unitBox).not.toBeNull();
  expect(expirationBox).not.toBeNull();
  expect(Math.abs(amountBox!.y - unitBox!.y)).toBeLessThan(16);
  expect(Math.abs(unitBox!.y - expirationBox!.y)).toBeLessThan(16);

  await page.getByLabel("Name").fill("Greek yogurt");
  await amountInput.fill("750");
  await unitButton.click();
  await page.getByRole("button", { name: "ml" }).click();
  await expirationInput.fill("2026-05-21");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Greek yogurt")).toBeVisible();
  await expect(page.getByText("750 ml")).toBeVisible();
  await expect(page.getByText("Exp: 21-05-26")).toBeVisible();
});

test("invalid fridge item edits stay inline and do not call update", async ({
  page,
}) => {
  const updateRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/updateFridgeIngredient/")) {
      updateRequests.push(request.url());
    }
  });

  await mockAuthenticatedFridgeApi(page, [
    {
      id: 3,
      name: "Yogurt",
      expirationDate: null,
      amount: "1",
      unit: "pcs",
    },
  ]);

  await page.goto("/Fridge");

  await page.getByRole("button", { name: /edit yogurt/i }).click();
  await page.getByLabel("Name").fill("");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Name is required.")).toBeVisible();
  expect(updateRequests).toHaveLength(0);

  await page.getByLabel("Name").fill("Yogurt");
  await page.getByLabel("Amount").fill("-1");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Enter a valid positive amount.")).toBeVisible();
  expect(updateRequests).toHaveLength(0);
});

test("editing a fridge item into a duplicate merges it", async ({ page }) => {
  await mockAuthenticatedFridgeApi(page, [
    {
      id: 1,
      name: "Milk",
      expirationDate: null,
      amount: "1",
      unit: "l",
    },
    {
      id: 2,
      name: "Oat milk",
      expirationDate: null,
      amount: "2",
      unit: "l",
    },
  ]);

  await page.goto("/Fridge");

  await page.getByRole("button", { name: /edit oat milk/i }).click();
  await page.getByLabel("Name").fill("Milk");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("1 item")).toBeVisible();
  await expect(page.getByText("Oat milk")).not.toBeVisible();
  await expect(page.getByText("3 l")).toBeVisible();
});

test("saving a zero amount removes the fridge item", async ({ page }) => {
  await mockAuthenticatedFridgeApi(page, [
    {
      id: 3,
      name: "Yogurt",
      expirationDate: null,
      amount: "1",
      unit: "pcs",
    },
  ]);

  await page.goto("/Fridge");

  await page.getByRole("button", { name: /edit yogurt/i }).click();
  await page.getByLabel("Amount").fill("0");

  await expect(page.getByText("Saving 0 will remove this item.")).toBeVisible();

  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("No ingredients in your inventory")).toBeVisible();
  await expect(page.getByText("0 items")).toBeVisible();
});
