import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { LanguageProvider } from "../src/context/languageContext";
import PlanPriceEntry from "../src/components/PlanPriceEntry";
import * as pricing from "../src/lib/planPricing";
import type { MealPlan } from "../src/lib/mealPlans";

vi.mock("../src/lib/planPricing", () => ({ savePlanPrice: vi.fn(), removePlanPrice: vi.fn() }));
const plan: MealPlan = { id: "plan", version: 8, createdAt: "2026-11-06T10:00:00Z", plan: { schemaVersion: 2,
  status: "DRAFT", slots: [], shopping: null, settings: { requestId: "plan", startDate: "2026-11-06", dayCount: 1,
    servings: 2, mealTypes: ["DINNER"], stores: ["LIDL"], budget: null, locale: "pl", maxMinutes: 45 } } };
const item: pricing.PricedItem = { key: "rice-key", name: "ryż", offer: null, packages: null, purchasedAmount: null,
  leftoverAmount: null, cost: null, missingReason: "NO_ELIGIBLE_OFFER", requiredAmount: 700, unit: "g" };
beforeEach(() => vi.clearAllMocks());
test("saves a private package price for the exact plan row store and shopping date", async () => {
  const saved = { ...plan, version: 9 }; vi.mocked(pricing.savePlanPrice).mockResolvedValue(saved);
  const onSaved = vi.fn();
  render(<LanguageProvider initialLocale="pl"><PlanPriceEntry plan={plan} item={item} stores={["LIDL"]} shoppingDate="2026-11-06" disabled={false} onSaved={onSaved} /></LanguageProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Dodaj znaną cenę" }));
  fireEvent.change(screen.getByLabelText("Ilość w jednym opakowaniu (g)"), { target: { value: "400" } });
  fireEvent.change(screen.getByLabelText("Cena za opakowanie (PLN)"), { target: { value: "4.25" } });
  fireEvent.click(screen.getByRole("button", { name: "Zapisz cenę" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
  expect(pricing.savePlanPrice).toHaveBeenCalledWith(plan, { key: "rice-key", store: "LIDL", shoppingDate: "2026-11-06", packageAmount: 400, packagePrice: 4.25 });
});
test("does not assign a price to an unknown or ambiguous quantity", () => {
  render(<LanguageProvider initialLocale="pl"><PlanPriceEntry plan={plan} item={{ ...item, missingReason: "CHECK_QUANTITY" }} stores={["LIDL"]} shoppingDate="2026-11-06" disabled={false} onSaved={vi.fn()} /></LanguageProvider>);
  expect(screen.queryByRole("button", { name: "Dodaj znaną cenę" })).not.toBeInTheDocument();
});
