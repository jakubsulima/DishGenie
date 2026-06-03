import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  mockPromoJourneyApi,
} from "./apiMocks";

const OUTPUT_DIR = path.join(process.cwd(), "public", "promo", "screens");

const preparePageForCapture = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
};

const settleBeforeCapture = async () => {
  await new Promise((resolve) => setTimeout(resolve, 450));
};

const waitForFonts = async (page: import("@playwright/test").Page) => {
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
  });
};

const captureScreen = async (
  page: import("@playwright/test").Page,
  fileName: string,
) => {
  await waitForFonts(page);
  await settleBeforeCapture();
  await page.screenshot({
    path: path.join(OUTPUT_DIR, fileName),
    animations: "disabled",
  });
};

test.describe("promo screenshot capture", () => {
  test.skip(
    process.env.PROMO_CAPTURE !== "1",
    "Promo capture runs only through npm run promo:capture",
  );

  test.use({
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
  });

  test.beforeAll(async () => {
    await preparePageForCapture();
  });

  test("captures the fridge screen", async ({ page }) => {
    await mockPromoJourneyApi(page);
    await page.goto("/Fridge");

    await expect(page.getByText("Quick Add Options")).toBeVisible();
    await expect(page.getByText("Spinach")).toBeVisible();

    await captureScreen(page, "01-fridge.png");
  });

  test("captures the preferences screen", async ({ page }) => {
    await mockPromoJourneyApi(page);
    await page.goto("/My Profile");

    await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();
    await page.getByRole("checkbox", { name: /vegetarian/i }).click();
    await page.getByPlaceholder("e.g., Olives").fill("Mushrooms");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Ingredient added")).toBeVisible();

    await captureScreen(page, "02-preferences.png");
  });

  test("captures the generated recipe screen", async ({ page }) => {
    await mockPromoJourneyApi(page);
    await page.goto("/");

    await page
      .getByPlaceholder("eggs, rice, spinach, chicken")
      .fill("quick creamy dinner");
    await page.getByRole("button", { name: "Dinner" }).click();
    await page.getByRole("button", { name: "Quick" }).click();
    await page.getByRole("button", { name: "Tell me what to cook" }).click();

    await expect(page.getByText("Creamy Coconut Chicken Bowl")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Recipe" })).toBeVisible();

    await captureScreen(page, "03-generated-recipe.png");
  });

  test("captures the saved recipe state", async ({ page }) => {
    await mockPromoJourneyApi(page);
    await page.goto("/");

    await page
      .getByPlaceholder("eggs, rice, spinach, chicken")
      .fill("quick creamy dinner");
    await page.getByRole("button", { name: "Dinner" }).click();
    await page.getByRole("button", { name: "Quick" }).click();
    await page.getByRole("button", { name: "Tell me what to cook" }).click();
    await expect(page.getByRole("button", { name: "Save Recipe" })).toBeVisible();

    await page.getByRole("button", { name: "Save Recipe" }).click();
    await expect(page.getByRole("button", { name: "Saved ✓" })).toBeVisible();

    await captureScreen(page, "04-saved-recipe.png");
  });

  test("captures the generated shopping list screen", async ({ page }) => {
    await mockPromoJourneyApi(page);
    await page.goto("/");

    await page
      .getByPlaceholder("eggs, rice, spinach, chicken")
      .fill("quick creamy dinner");
    await page.getByRole("button", { name: "Dinner" }).click();
    await page.getByRole("button", { name: "Quick" }).click();
    await page.getByRole("button", { name: "Tell me what to cook" }).click();
    await expect(
      page.getByRole("button", { name: "Generate Shopping List" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Generate Shopping List" }).click();
    await expect(
      page.getByRole("heading", { name: "Shopping List" }),
    ).toBeVisible();

    await captureScreen(page, "05-shopping-list.png");
  });
});
