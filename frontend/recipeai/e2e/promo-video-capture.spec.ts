import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { mockPromoJourneyApi } from "./apiMocks";

const OUTPUT_DIR = path.join(process.cwd(), "public", "promo", "clips");
const SCREEN_OUTPUT_DIR = path.join(process.cwd(), "public", "promo", "screens");
const VIEWPORT = { width: 390, height: 844 };

const prepareOutputDir = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(SCREEN_OUTPUT_DIR, { recursive: true });
};

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const recordPromoPage = async (
  browser: import("@playwright/test").Browser,
  fileName: string,
  capture: (page: import("@playwright/test").Page) => Promise<void>,
) => {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "light",
    recordVideo: {
      dir: OUTPUT_DIR,
      size: VIEWPORT,
    },
  });
  const page = await context.newPage();
  const video = page.video();

  if (!video) {
    throw new Error("Playwright video recording is not available.");
  }

  await mockPromoJourneyApi(page);
  await capture(page);
  await context.close();
  const sourcePath = await video.path();
  const targetPath = path.join(OUTPUT_DIR, fileName);

  await video.saveAs(targetPath);

  if (sourcePath !== targetPath) {
    await fs.rm(sourcePath, { force: true });
  }
};

const generatePromoRecipe = async (
  page: import("@playwright/test").Page,
  recipeTitle: string,
) => {
  await page.goto("/");
  await page
    .getByPlaceholder("eggs, rice, spinach, chicken")
    .fill("quick creamy dinner");
  await page.getByRole("button", { name: "Dinner" }).click();
  await page.getByRole("button", { name: "Quick" }).click();
  await page.getByRole("button", { name: "Tell me what to cook" }).click();
  await expect(page.getByText(recipeTitle)).toBeVisible();
};

const captureHomepageCreateState = async (
  page: import("@playwright/test").Page,
) => {
  await page.goto("/");
  await page
    .getByPlaceholder("eggs, rice, spinach, chicken")
    .fill("quick creamy dinner");
  await page.getByRole("button", { name: "Dinner" }).click();
  await page.getByRole("button", { name: "Quick" }).click();
  await page.screenshot({
    path: path.join(SCREEN_OUTPUT_DIR, "00-home-create-promo.png"),
    animations: "disabled",
  });
};

test.describe("promo video capture", () => {
  test.skip(
    process.env.PROMO_CAPTURE_VIDEO !== "1",
    "Promo video capture runs only through npm run promo:capture:clips",
  );

  test.beforeAll(async () => {
    await prepareOutputDir();
  });

  test("records the fridge interaction clip", async ({ browser }) => {
    await recordPromoPage(browser, "01-fridge-clip.webm", async (page) => {
      await page.goto("/Fridge");
      await expect(page.getByText("Quick Add Options")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Spinach" }),
      ).toBeVisible();

      await wait(220);
      await page.mouse.wheel(0, 180);
      await wait(220);
      await page.mouse.wheel(0, 140);
      await page.screenshot({
        path: path.join(SCREEN_OUTPUT_DIR, "01-fridge-list-promo.png"),
        animations: "disabled",
      });
      await wait(900);
    });
  });

  test("records the recipe reveal clip", async ({ browser }) => {
    await recordPromoPage(browser, "02-recipe-reveal-clip.webm", async (page) => {
      await captureHomepageCreateState(page);
      await generatePromoRecipe(page, "Creamy Coconut Chicken Bowl");
      await wait(900);
    });
  });

  test("records the recipe proof clip", async ({ browser }) => {
    await recordPromoPage(browser, "03-recipe-proof-clip.webm", async (page) => {
      await generatePromoRecipe(page, "Creamy Coconut Chicken Bowl");
      await wait(1400);
    });
  });
});
