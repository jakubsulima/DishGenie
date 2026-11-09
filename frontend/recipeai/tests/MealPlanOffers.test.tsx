import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { LanguageProvider } from "../src/context/languageContext";
import MealPlanOffers from "../src/components/MealPlanOffers";
import { getPlanningOffers, type MealPlan } from "../src/lib/mealPlans";
vi.mock("../src/lib/mealPlans", () => ({ getPlanningOffers: vi.fn() }));
vi.mock("../src/lib/planPricing", () => ({ refreshStorePrices: vi.fn() }));
const plan: MealPlan = { id: "test-plan", version: 4, createdAt: "2026-11-06T10:00:00Z", plan: { schemaVersion: 2, status: "DRAFT", shopping: null,
  settings: { requestId: "test-plan", startDate: "2026-11-06", dayCount: 1, servings: 2, mealTypes: ["DINNER"], stores: ["LIDL"], budget: null, locale: "pl", maxMinutes: 45 },
  slots: [{ id: "slot", date: "2026-11-06", mealType: "DINNER", servings: 2, locked: false, skipped: false, recipe: null, generationId: null, generationStatus: null, generationStartedAt: null }] } };
const offer = { id: "offer", version: 0, details: { store: "LIDL" as const, productName: "Ryż — dane testowe", packageAmount: 500, unit: "g", packagePrice: 3.99,
  minimumPackages: 1, packageMultiple: 1, maximumPackages: null, loyaltyRequired: false, validFrom: "2026-11-06", validTo: "2026-11-07", sourceUrl: "https://www.lidl.pl/p/test-fixture", conditions: "Dane testowe", verifiedAt: "2026-11-06T10:00:00Z" } };
beforeEach(() => vi.clearAllMocks());
test("shows checked prices before starting and replans only after the user's click", async () => {
  vi.mocked(getPlanningOffers).mockResolvedValue({ version: 4, offers: [offer] });
  const onReplan = vi.fn();
  render(<LanguageProvider initialLocale="pl"><MealPlanOffers plan={plan} disabled={false} onReplan={onReplan} /></LanguageProvider>);
  expect(await screen.findByText(offer.details.productName)).toBeVisible();
  expect(screen.getByText(/3,99/)).toBeVisible(); expect(onReplan).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Ułóż plan z tych okazji" }));
  expect(onReplan).toHaveBeenCalledOnce();
});
test("an empty catalog cannot start a misleading plan with no prices", async () => {
  vi.mocked(getPlanningOffers).mockResolvedValue({ version: 4, offers: [] });
  render(<LanguageProvider initialLocale="pl"><MealPlanOffers plan={plan} disabled={false} onReplan={vi.fn()} /></LanguageProvider>);
  expect(await screen.findByText(/Brak produktów z cenami pasujących/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Ułóż plan z tych okazji" })).toBeDisabled();
});
test("a response for another plan version cannot enable replanning", async () => {
  vi.mocked(getPlanningOffers).mockResolvedValue({ version: 3, offers: [offer] });
  render(<LanguageProvider initialLocale="pl"><MealPlanOffers plan={plan} disabled={false} onReplan={vi.fn()} /></LanguageProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się sprawdzić ofert");
  expect(screen.getByRole("button", { name: "Ułóż plan z tych okazji" })).toBeDisabled();
});
