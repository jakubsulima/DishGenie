import { expect, test } from "@playwright/test";
import { mockShoppingListApi } from "./apiMocks";
import type { MealPlan } from "../src/lib/mealPlans";

for (const width of [390, 1440]) {
  test(`shopping lists keep their layout and drafts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockShoppingListApi(page);
    const today = new Date().toLocaleDateString("en-CA");
    const past = new Date(); past.setDate(past.getDate() - 1);
    const yesterday = past.toLocaleDateString("en-CA");
    const plan: MealPlan = { id: "disclosure-plan", version: 2, createdAt: new Date().toISOString(), plan: {
      schemaVersion: 2, status: "DRAFT", shopping: null,
      settings: { requestId: "disclosure-plan", startDate: yesterday, dayCount: 1, servings: 2, mealTypes: ["DINNER"], stores: ["LIDL"], budget: null, locale: "pl", maxMinutes: 30,
        shopping: { shoppingDate: yesterday, maxStores: 1, loyaltyStores: [], confirmedCouponOffers: [], selectedOffers: [], allowRepeats: false } },
      slots: [{ id: "slot", date: yesterday, mealType: "DINNER", servings: 2, locked: false, skipped: false, generationId: null, generationStatus: null, generationStartedAt: null,
        recipe: { name: "Test meal", description: "", timeToPrepare: "20 min", servings: 2, ingredients: [{ name: "Rice", amount: 100, unit: "g" }], instructions: ["Cook."] } }],
    } };
    const offers = Array.from({ length: 18 }, (_, index) => ({ id: `offer-${index}`, version: 0, details: { store: "LIDL", productName: `Product ${index + 1}`, packageAmount: 500, unit: "g", packagePrice: 3.99,
      minimumPackages: 1, packageMultiple: 1, maximumPackages: null, loyaltyRequired: false, validFrom: today, validTo: today, sourceUrl: "https://www.lidl.pl/p/test-fixture", conditions: "Test conditions. ".repeat(12), verifiedAt: new Date().toISOString() } }));
    let quotes = 0;
    await page.route("**/v3/meal-plans**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/meal-plans")) return route.fulfill({ json: [] });
      if (path.endsWith("/generations/latest")) return route.fulfill({ json: null });
      if (path.endsWith("/planning-offers")) return route.fulfill({ json: { version: 2, offers } });
      if (path.endsWith("/quote-preview")) {
        expect(route.request().postDataJSON().shoppingDate).toBe(today);
        quotes++;
        return route.fulfill({ json: { planId: plan.id, planVersion: 2, shoppingDate: today, calculatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 900000).toISOString(), budget: null,
          baskets: [{ option: "LIDL", stores: ["LIDL"], knownTotal: 0, pricedItems: 0, missingItems: 18, budgetStatus: "INCOMPLETE",
            items: offers.map((_, index) => ({ key: `item-${index}`, name: `Ingredient ${index + 1}`, unit: "g", requiredAmount: 100, offer: null, packages: null, purchasedAmount: null, leftoverAmount: null, cost: null, missingReason: "NO_ELIGIBLE_OFFER" })) }] } });
      }
      return route.fulfill({ json: plan });
    });
    await page.goto("/MealPlanner?plan=disclosure-plan&view=shopping");
    await expect(page.getByText(/18 without a price/)).toBeVisible();
    const compare = page.getByText("Compare shopping costs", { exact: true });
    const originalBounds = await compare.boundingBox();
    const initialQuotes = quotes;
    await compare.click();
    const expandedBounds = await compare.boundingBox();
    expect(expandedBounds!.x).toBe(originalBounds!.x);
    expect(expandedBounds!.width).toBe(originalBounds!.width);
    expect(expandedBounds!.y).toBe(originalBounds!.y);
    await expect(page.getByLabel("Shopping date", { exact: true })).toHaveValue(today);
    await page.getByRole("button", { name: "Where do prices come from?" }).click();
    await expect(page.getByRole("link", { name: "Lidl leaflets" })).toHaveAttribute("href", "https://www.lidl.pl/c/nasze-gazetki/s10008614");
    await expect(page.getByRole("link", { name: "Bakery", exact: true })).toHaveCount(0);
    await expect(page.getByText(/We read the complete official Lidl leaflet and use reviewed meal ingredients/)).toBeVisible();
    await page.getByRole("button", { name: "Where do prices come from?" }).click();
    await page.getByText("Shopping details and conditions", { exact: true }).click();
    const priceList = page.getByRole("list").filter({ hasText: "Ingredient 1" });
    expect((await priceList.boundingBox())!.height).toBeLessThanOrEqual(450);
    await page.getByRole("button", { name: "Add a known price" }).first().click();
    await page.getByLabel("Price per package (PLN)").fill("4.25");
    await compare.click(); await compare.click();
    await expect(page.getByLabel("Price per package (PLN)")).toHaveValue("4.25");
    expect(quotes).toBe(initialQuotes);
    await compare.click();
    await page.getByText("Offers and replanning", { exact: true }).click();
    await expect(page.getByText("Product 18", { exact: true })).toBeAttached();
    const products = page.getByRole("list").filter({ hasText: "Product 18" });
    expect((await products.boundingBox())!.height).toBeLessThanOrEqual(450);
    const conditions = page.getByRole("button", { name: "Offer conditions", exact: true }).first();
    await conditions.scrollIntoViewIfNeeded();
    const listBounds = await products.boundingBox();
    const beforeScroll = await page.evaluate(() => scrollY);
    await conditions.click();
    expect((await products.boundingBox())!.height).toBe(listBounds!.height);
    expect((await products.boundingBox())!.y).toBe(listBounds!.y);
    expect(await page.evaluate(() => scrollY)).toBe(beforeScroll);
    await expect(page.getByText("Test conditions.", { exact: false }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/planner-shopping-lists-${width}.png` });
  });
}
