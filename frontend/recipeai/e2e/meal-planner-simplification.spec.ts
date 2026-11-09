import { expect, test } from "@playwright/test";
import { mockShoppingListApi } from "./apiMocks";
import type { MealPlan } from "../src/lib/mealPlans";

const localDateInput = (days = 0) => {
  const date = new Date(); date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

for (const width of [360, 390, 1440]) {
  test(`compact planner, drafts and keyboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockShoppingListApi(page);
    const today = localDateInput();
    const name = "Roasted apple and plum salad with buckwheat, walnuts and a very long seasonal dressing name";
    const saved: MealPlan = { id: "fixture-plan", version: 4, createdAt: new Date().toISOString(), plan: {
      schemaVersion: 2, status: "DRAFT", shopping: null,
      settings: { requestId: "fixture-plan", startDate: today, dayCount: 7, servings: 2, mealTypes: ["LUNCH", "DINNER"], stores: ["LIDL"], budget: null, locale: "pl", maxMinutes: 45,
        shopping: { shoppingDate: today, maxStores: 1, loyaltyStores: [], confirmedCouponOffers: [], selectedOffers: [], allowRepeats: false } },
      slots: Array.from({ length: 14 }, (_, index) => ({ id: `slot-${index}`, date: localDateInput(Math.floor(index / 2)), mealType: index % 2 ? "DINNER" : "LUNCH", servings: 2, skipped: false, locked: false,
        recipe: index ? null : { name, description: "A test recipe", timeToPrepare: "30 min", servings: 2, ingredients: [{ name: "Rice", amount: 300, unit: "g" }], instructions: ["Cook the rice."] },
        generationId: null, generationStatus: null, generationStartedAt: null })),
    } };
    let accepted = 0;
    await page.route("**/v2/offers?**", route => route.fulfill({ json: { offers: [], sourceStatus: "MANUAL_REVIEW_ONLY" } }));
    await page.route("**/v2/shopping-preferences", route => route.fulfill({ json: saved.plan.settings }));
    await page.route("**/v3/meal-plans**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/meal-plans")) return route.fulfill({ json: [{ id: saved.id, startDate: today, dayCount: 7, status: "DRAFT", plannedSlots: 1, totalSlots: 14, version: saved.version }] });
      if (path.endsWith("/generations/latest")) return route.fulfill({ json: null });
      if (path.endsWith("/generations")) return route.fulfill({ status: 429, json: { message: "Test allowance exhausted" } });
      if (path.endsWith("/revisions/latest")) return route.fulfill({ json: {} });
      if (path.endsWith("/accept")) accepted++;
      if (path.endsWith("/quote-preview")) return route.fulfill({ json: { planId: saved.id, planVersion: saved.version, shoppingDate: today, budget: null,
        calculatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 900000).toISOString(),
        baskets: [{ option: "LIDL", stores: ["LIDL"], knownTotal: 42, pricedItems: 4, missingItems: 3, budgetStatus: "INCOMPLETE", items: [] }] } });
      return route.fulfill({ json: saved });
    });
    await page.goto("/MealPlanner");
    const first = page.locator('article[id^="meal-slot-"]').first();
    await expect(first.getByRole("button", { name, exact: true })).toBeVisible();
    expect((await first.boundingBox())!.y).toBeLessThan(500);
    expect((await page.getByRole("heading", { level: 1 }).boundingBox())!.height).toBeLessThan(44);
    expect(await first.locator("button:visible").allTextContents()).toEqual([name, "Swap", "⋯"]);
    expect(await page.locator('article[id^="meal-slot-"]').nth(1).locator("button:visible").allTextContents()).toEqual(["+ Add meal", "⋯"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/meal-planner-simplified-${width}.png` });

    const options = first.getByRole("button", { name: "Meal options" });
    await options.focus(); await options.press("Enter");
    await expect(page.getByRole("button", { name: "Skip meal" })).toBeVisible();
    await options.press("Escape"); await expect(options).toBeFocused();
    await first.getByRole("button", { name, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Ingredients", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).press("Escape");
    await expect(first.getByRole("button", { name, exact: true })).toBeFocused();

    await options.click(); await page.getByRole("button", { name: "Edit recipe", exact: true }).click();
    await dialog.getByLabel("Recipe name").fill("Unfinished recipe draft");
    // Native modal focus stays inside the panel when tabbing through its controls.
    await dialog.getByRole("button", { name: "Close", exact: true }).focus();
    await dialog.getByRole("button", { name: "Close", exact: true }).press("Shift+Tab");
    expect(await page.evaluate(() => document.querySelector("dialog[open]")?.contains(document.activeElement))).toBe(true);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Shopping", exact: true }).click();
    expect(accepted).toBe(0);
    await expect(page.getByRole("button", { name: "Accept plan and create shopping list" })).toBeVisible();
    await expect(page.getByText(/3 without a price/)).toBeVisible();
    await expect(page.getByText("This is the priced subtotal, not the full shopping cost.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await options.click(); await page.getByRole("button", { name: "Edit recipe", exact: true }).click();
    await expect(dialog.getByLabel("Recipe name")).toHaveValue("Unfinished recipe draft");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();

    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("button", { name: "Plan options" }).click();
    await page.getByRole("button", { name: "New plan", exact: true }).click();
    await expect(first.getByRole("button", { name, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Complete the week" }).click();
    await expect(page.getByRole("alert")).toContainText("Generation limit reached");
    await expect(first.getByRole("button", { name, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
