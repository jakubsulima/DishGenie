import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LanguageProvider } from "../src/context/languageContext";
import MealPlanPricing from "../src/components/MealPlanPricing";
import { localDateInput, type MealPlan } from "../src/lib/mealPlans";
import { quoteMealPlan, type PlanQuote } from "../src/lib/planPricing";

vi.mock("../src/lib/planPricing", () => ({ quoteMealPlan: vi.fn() }));
const today = localDateInput();
const plan: MealPlan = { id: "plan", version: 8, createdAt: new Date().toISOString(), plan: {
  schemaVersion: 1, status: "ACCEPTED", settings: { requestId: "plan", startDate: today, dayCount: 1, servings: 2,
    mealTypes: ["DINNER"], stores: ["LIDL", "BIEDRONKA"], budget: 50, locale: "en", maxMinutes: 30 },
  slots: [], shopping: { calculatedAt: new Date().toISOString(), checkedKeys: [], items: [] },
} };
const fixture = (): PlanQuote => ({ planId: plan.id, planVersion: 8, shoppingDate: today,
  calculatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 900_000).toISOString(), budget: 50,
  baskets: [{ option: "LIDL", stores: ["LIDL"], knownTotal: 0, pricedItems: 0, missingItems: 1,
    budgetStatus: "INCOMPLETE", items: [{ key: "rice", name: "Rice", offer: null, packages: null,
      purchasedAmount: null, leftoverAmount: null, cost: null, missingReason: "NO_ELIGIBLE_OFFER" }] }] });
const show = () => render(<LanguageProvider initialLocale="en"><MealPlanPricing plan={plan} disabled={false} /></LanguageProvider>);
afterEach(() => { vi.clearAllMocks(); });

describe("Meal plan pricing", () => {
  test("does not present missing prices as a free basket or confirm budget", async () => {
    vi.mocked(quoteMealPlan).mockResolvedValue(fixture()); show();
    fireEvent.click(screen.getByRole("button", { name: "Compare prices" }));
    expect(await screen.findByText("No verified prices")).toBeVisible();
    expect(screen.getByText("Incomplete quote — budget not confirmed")).toBeVisible();
    expect(screen.queryByText("Estimated basket within budget")).not.toBeInTheDocument();
    expect(quoteMealPlan).toHaveBeenCalledWith(plan, today, []);
  });
  test("changing loyalty eligibility clears the previous quote and passes explicit eligibility", async () => {
    vi.mocked(quoteMealPlan).mockResolvedValue(fixture()); show();
    fireEvent.click(screen.getByRole("button", { name: "Compare prices" }));
    await screen.findByText("No verified prices");
    fireEvent.click(screen.getByLabelText("I can use Lidl Plus and activate the required coupon"));
    expect(screen.queryByText("No verified prices")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare prices" }));
    await waitFor(() => expect(quoteMealPlan).toHaveBeenLastCalledWith(plan, today, ["LIDL"]));
  });
  test("shows actual package costs, leftovers, conditions and source", async () => {
    const quote = fixture(); const basket = quote.baskets[0];
    basket.knownTotal = 7.98; basket.pricedItems = 1; basket.missingItems = 0; basket.budgetStatus = "WITHIN_BUDGET";
    basket.items[0] = { key: "rice", name: "Rice", packages: 2, purchasedAmount: 800, leftoverAmount: 200, cost: 7.98,
      missingReason: null, offer: { id: "offer", version: 0, details: { store: "LIDL", productName: "Rice 400 g", packageAmount: 400, unit: "g",
        packagePrice: 3.99, minimumPackages: 2, packageMultiple: 1, maximumPackages: 4, loyaltyRequired: true,
        validFrom: today, validTo: today, sourceUrl: "https://www.lidl.pl/p/test-fixture", conditions: "Buy two with a coupon", verifiedAt: new Date().toISOString() } } };
    vi.mocked(quoteMealPlan).mockResolvedValue(quote); show();
    fireEvent.click(screen.getByRole("button", { name: "Compare prices" }));
    expect(await screen.findByText("Estimated basket within budget")).toBeVisible();
    expect(screen.getByText("Buy two with a coupon")).toBeVisible();
    expect(screen.getByText("Left after these meals: 200 g")).toBeVisible();
    expect(screen.getByRole("link", { name: "Offer source" })).toHaveAttribute("href", "https://www.lidl.pl/p/test-fixture");
  });
  test("expired quote no longer displays a valid budget claim", async () => {
    const quote = fixture(); quote.expiresAt = new Date(Date.now() - 1000).toISOString();
    vi.mocked(quoteMealPlan).mockResolvedValue(quote); show();
    fireEvent.click(screen.getByRole("button", { name: "Compare prices" }));
    expect(await screen.findByText("This quote has expired. Compare prices again before shopping.")).toBeVisible();
    expect(screen.queryByText("No verified prices")).not.toBeInTheDocument();
  });
  test("request failure gives a retry without displaying an old result", async () => {
    vi.mocked(quoteMealPlan).mockRejectedValue(new Error("offline")); show();
    fireEvent.click(screen.getByRole("button", { name: "Compare prices" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not price this plan");
    expect(screen.getByRole("button", { name: "Compare prices" })).toBeEnabled();
  });
});
