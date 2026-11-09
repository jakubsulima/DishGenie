import { expect, test } from "@playwright/test";
import { mockShoppingListApi } from "./apiMocks";
import type { MealPlan, PlanSettings } from "../src/lib/mealPlans";

for (const mobile of [false, true]) {
  test(`legacy meal planner persists meals and shopping ${mobile ? "mobile Polish" : "desktop English"}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await mockShoppingListApi(page);
    if (mobile) await page.addInitScript(() => localStorage.setItem("dishGenie.locale", "pl"));
    const date = new Date(); const startDate = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    let saved: MealPlan | null = {id:"legacy-plan",version:0,createdAt:date.toISOString(),plan:{schemaVersion:2,status:"DRAFT",shopping:null,
      settings:{requestId:"legacy-plan",startDate,dayCount:1,servings:2,mealTypes:["LUNCH","DINNER"],stores:["LIDL"],budget:null,locale:"pl",maxMinutes:45},
      slots:(["LUNCH","DINNER"] as const).map((mealType,index)=>({id:`slot-${index}`,date:startDate,mealType,servings:2,locked:false,skipped:false,recipe:null,generationId:null,generationStatus:null,generationStartedAt:null}))}};
    let generation: { id: string; planId: string; status: string; completed: number; total: number; error: null } | null = null;
    const generationRequests: string[] = [];
    await page.route("**/v2/shopping-preferences", route => route.fulfill({ json: null }));
    await page.route("**/v2/offers?**", route => route.fulfill({ json: { offers: [], sourceStatus: "MANUAL_REVIEW_ONLY" } }));
    await page.route("**/v3/meal-plans**", async route => {
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
      } else if (path.endsWith("/planning-offers")) {
        await route.fulfill({ json: { version: saved?.version ?? 0, offers: [] } }); return;
      } else if (path.endsWith("/generations/latest")) {
        await route.fulfill({ json: generation }); return;
      } else if (generation && path.endsWith("/cancel")) {
        generation.status = "CANCELLED";
        await route.fulfill({ json: generation }); return;
      } else if (saved && path.endsWith("/generations")) {
        generationRequests.push(body.requestId);
        if (generation?.id === body.requestId) {
          await route.fulfill({ status: 202, json: generation }); return;
        }
        if (generationRequests.length === 1) {
          generation = { id: body.requestId, planId: saved.id, status: "QUEUED", completed: 0, total: saved.plan.slots.length, error: null };
          await route.fulfill({ status: 202, json: generation }); return;
        }
        for (const slot of saved.plan.slots) slot.recipe = { name: `${mobile ? "Ryż" : "Rice"} ${slot.mealType}`, description: "", servings: 2,
          timeToPrepare: "20 min", ingredients: [{ name: "Rice", amount: 300, unit: "g" }], instructions: ["Cook rice"] };
        saved.version += 4;
        generation = { id: body.requestId, planId: saved.id, status: "COMPLETED", completed: saved.plan.slots.length, total: saved.plan.slots.length, error: null };
        await route.fulfill({ status: 202, json: generation }); return;
      } else if (saved && path.endsWith("/generate")) {
        const slot = saved.plan.slots.find(s => path.includes(`/slots/${s.id}/`))!;
        slot.recipe = { name: `${mobile ? "Ryż" : "Rice"} ${slot.mealType}`, description: "", servings: 2,
          timeToPrepare: "20 min", ingredients: [{ name: "Rice", amount: 300, unit: "g" }], instructions: ["Cook rice"] };
        saved.version += 2;
      } else if (saved && path.endsWith("/accept")) {
        saved.plan.status = "ACCEPTED"; saved.version++;
        saved.plan.shopping = { calculatedAt: new Date().toISOString(), checkedKeys: [], items: [
          { key: "rice", name: "Rice", amount: 200, unit: "g", usedFromFridge: 400, slotIds: ["slot-0", "slot-1"], needsReview: false }] };
      } else if (saved && path.endsWith("/quote-preview")) {
        await route.fulfill({ json: { planId: saved.id, planVersion: saved.version, shoppingDate: body.shoppingDate,
          calculatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 900_000).toISOString(), budget: saved.plan.settings.budget,
          baskets: ["LIDL"].map(option => ({ option, stores: option === "COMBINED" ? ["LIDL", "BIEDRONKA"] : [option],
            knownTotal: 0, pricedItems: 0, missingItems: 1, budgetStatus: "INCOMPLETE", items: [{ key: "rice", name: "Rice", offer: null,
              packages: null, purchasedAmount: null, leftoverAmount: null, cost: null, missingReason: "NO_ELIGIBLE_OFFER" }] })) } });
        return;
      } else if (saved && path.endsWith("/check")) {
        saved.plan.shopping!.checkedKeys = body.checked ? [body.key] : []; saved.version++;
      }
      await route.fulfill({ json: saved });
    });
    await page.goto("/MealPlanner");
    await page.getByRole("button", { name: mobile ? "Zaplanuj tydzień" : "Plan the week" }).click();
    await page.getByRole("button", { name: mobile ? "Zatrzymaj po tym daniu" : "Stop after this meal" }).click();
    const generate = page.getByRole("button", { name: mobile ? "Zaplanuj tydzień" : "Plan the week" });
    await expect(generate).toBeEnabled();
    await generate.click();
    await expect(page.getByRole("heading", { name: mobile ? "Ryż DINNER" : "Rice DINNER" })).toBeVisible();
    expect(generationRequests).toHaveLength(2);
    expect(generationRequests[1]).not.toBe(generationRequests[0]);
    await page.getByRole("button", { name: mobile ? "Przejdź do zakupów" : "Go to shopping" }).click();
    await page.getByRole("button", { name: mobile ? "Zaakceptuj plan i utwórz listę zakupów" : "Accept plan and create shopping list" }).click();
    await page.getByRole("checkbox", { name: "Rice", exact: true }).check();
    await expect(page.getByRole("checkbox", { name: "Rice", exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Rice", exact: true })).toBeChecked();
    await page.getByText(mobile ? "Porównaj koszt zakupów" : "Compare shopping costs", { exact: true }).click();
    await page.getByRole("button", { name: mobile ? "Porównaj ceny" : "Compare prices" }).click();
    await expect(page.getByText(mobile ? "Niepełna wycena — brakujące ceny" : "Incomplete quote — missing prices")).toHaveCount(1);
    await expect(page.getByText(mobile ? "Brak zweryfikowanych cen" : "No verified prices", { exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/meal-planner-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
  });
}
