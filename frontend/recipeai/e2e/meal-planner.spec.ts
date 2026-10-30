import { expect, test } from "@playwright/test";
import { mockShoppingListApi } from "./apiMocks";
import type { MealPlan, PlanSettings } from "../src/lib/mealPlans";

for (const mobile of [false, true]) {
  test(`meal planner persists meals and shopping ${mobile ? "mobile Polish" : "desktop English"}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await mockShoppingListApi(page);
    if (mobile) await page.addInitScript(() => localStorage.setItem("dishGenie.locale", "pl"));
    let saved: MealPlan | null = null;
    await page.route("**/v2/meal-plans**", async route => {
      const path = new URL(route.request().url()).pathname;
      const body = route.request().postDataJSON();
      if (path.endsWith("meal-plans") && route.request().method() === "POST") {
        const settings: PlanSettings = body;
        saved = { id: settings.requestId, version: 0, createdAt: new Date().toISOString(), plan: {
          schemaVersion: 1, settings, status: "DRAFT", shopping: null,
          slots: settings.mealTypes.map((mealType, index) => ({ id: `slot-${index}`, date: settings.startDate,
            mealType, servings: settings.servings, locked: false, skipped: false, recipe: null,
            generationId: null, generationStatus: null, generationStartedAt: null })) } };
      } else if (path.endsWith("meal-plans")) {
        await route.fulfill({ json: saved ? [{ id: saved.id, version: saved.version, startDate: saved.plan.settings.startDate,
          dayCount: 1, status: saved.plan.status, plannedSlots: saved.plan.slots.filter(s => s.recipe).length, totalSlots: 2 }] : [] });
        return;
      } else if (saved && path.endsWith("/generate")) {
        const slot = saved.plan.slots.find(s => path.includes(`/slots/${s.id}/`))!;
        slot.recipe = { name: `${mobile ? "Ryż" : "Rice"} ${slot.mealType}`, description: "", servings: 2,
          timeToPrepare: "20 min", ingredients: [{ name: "Rice", amount: 300, unit: "g" }], instructions: ["Cook rice"] };
        saved.version += 2;
      } else if (saved && path.endsWith("/accept")) {
        saved.plan.status = "ACCEPTED"; saved.version++;
        saved.plan.shopping = { calculatedAt: new Date().toISOString(), checkedKeys: [], items: [
          { key: "rice", name: "Rice", amount: 200, unit: "g", usedFromFridge: 400, slotIds: ["slot-0", "slot-1"], needsReview: false }] };
      } else if (saved && path.endsWith("/quote")) {
        await route.fulfill({ json: { planId: saved.id, planVersion: saved.version, shoppingDate: body.shoppingDate,
          calculatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 900_000).toISOString(), budget: 300,
          baskets: ["LIDL", "BIEDRONKA", "COMBINED"].map(option => ({ option, stores: option === "COMBINED" ? ["LIDL", "BIEDRONKA"] : [option],
            knownTotal: 0, pricedItems: 0, missingItems: 1, budgetStatus: "INCOMPLETE", items: [{ key: "rice", name: "Rice", offer: null,
              packages: null, purchasedAmount: null, leftoverAmount: null, cost: null, missingReason: "NO_ELIGIBLE_OFFER" }] })) } });
        return;
      } else if (saved && path.endsWith("/check")) {
        saved.plan.shopping!.checkedKeys = body.checked ? [body.key] : []; saved.version++;
      }
      await route.fulfill({ json: saved });
    });
    await page.goto("/MealPlanner");
    await page.getByLabel(mobile ? "Liczba dni" : "Number of days").fill("1");
    await page.getByRole("button", { name: mobile ? "Utwórz jadłospis" : "Create meal plan" }).click();
    await page.getByRole("button", { name: mobile ? "Zaplanuj brakujące posiłki" : "Generate missing meals" }).click();
    await expect(page.getByRole("heading", { name: mobile ? "Ryż DINNER" : "Rice DINNER" })).toBeVisible();
    await page.getByRole("button", { name: mobile ? "Zaakceptuj plan i utwórz listę zakupów" : "Accept plan and create shopping list" }).click();
    await page.getByRole("checkbox", { name: "Rice", exact: true }).check();
    await expect(page.getByRole("checkbox", { name: "Rice", exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Rice", exact: true })).toBeChecked();
    await page.getByRole("button", { name: mobile ? "Porównaj ceny" : "Compare prices" }).click();
    await expect(page.getByText(mobile ? "Niepełna wycena — budżet niepotwierdzony" : "Incomplete quote — budget not confirmed")).toHaveCount(3);
    await expect(page.getByText(mobile ? "Brak zweryfikowanych cen" : "No verified prices")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/meal-planner-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
  });
}
