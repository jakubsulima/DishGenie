import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { LanguageProvider } from "../src/context/languageContext";
import MealPlanner from "../src/pages/MealPlanner";
import MealPlanForm from "../src/components/MealPlanForm";
import * as api from "../src/lib/mealPlans";
import type { MealPlan, PlanRecipe } from "../src/lib/mealPlans";

vi.mock("../src/lib/mealPlans", async importOriginal => ({
  ...await importOriginal<typeof api>(),
  listMealPlans: vi.fn(), getMealPlan: vi.fn(), createMealPlan: vi.fn(),
  generatePlanSlot: vi.fn(), changePlanSlot: vi.fn(), acceptMealPlan: vi.fn(),
  checkPlanShopping: vi.fn(), refreshPlanShopping: vi.fn(),
  getShoppingPreferences: vi.fn(), startWeekGeneration: vi.fn(), getWeekGeneration: vi.fn(), cancelWeekGeneration: vi.fn(),
  latestPlanRevision: vi.fn().mockResolvedValue({}), previewRevision: vi.fn(), applyRevision: vi.fn(), undoRevision: vi.fn(),
}));
vi.mock("../src/lib/planPricing", () => ({ getOffers: vi.fn().mockResolvedValue({ offers: [], sourceStatus: "MANUAL_REVIEW_ONLY" }), quoteMealPlan: vi.fn().mockResolvedValue({ planId: "plan-1", planVersion: 0, budget: null, shoppingDate: "2026-10-29", calculatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 900000).toISOString(), baskets: [] }) }));
vi.mock("../src/lib/posthog", () => ({ captureEvent: vi.fn() }));

const recipe: PlanRecipe = { name: "Rice bowl", description: "Simple", timeToPrepare: "20 min", servings: 2,
  ingredients: [{ name: "rice", amount: 300, unit: "g" }], instructions: ["Cook rice"] };
const fixture = (): MealPlan => ({ id: "plan-1", version: 0, createdAt: "2026-10-29T09:00:00Z",
  plan: { schemaVersion: 1, status: "DRAFT", settings: { requestId: "plan-1", startDate: "2026-10-29", dayCount: 1,
    servings: 2, mealTypes: ["LUNCH", "DINNER"], stores: ["LIDL", "BIEDRONKA"], budget: 300, locale: "en", maxMinutes: 45 },
  slots: ["LUNCH", "DINNER"].map((type, index) => ({ id: `slot-${index}`, date: "2026-10-29",
    mealType: type === "LUNCH" ? "LUNCH" : "DINNER", servings: 2, locked: false, skipped: false, recipe: null,
    generationId: null, generationStatus: null, generationStartedAt: null })), shopping: null } });
const renderPlanner = () => render(<LanguageProvider initialLocale="en"><MemoryRouter initialEntries={["/MealPlanner?plan=plan-1"]}><MealPlanner /></MemoryRouter></LanguageProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getShoppingPreferences).mockResolvedValue(null);
  vi.mocked(api.getWeekGeneration).mockResolvedValue(null);
  vi.mocked(api.listMealPlans).mockResolvedValue([]);
  vi.mocked(api.getMealPlan).mockResolvedValue(fixture());
});

describe("Meal planner", () => {
  test("creates a Polish week without a budget and defaults to one store", async () => {
    const onCreate = vi.fn();
    render(<LanguageProvider initialLocale="pl"><MealPlanForm busy={false} onCreate={onCreate} /></LanguageProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Utwórz jadłospis" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Utwórz jadłospis" }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ budget: null, budgetMode: "NONE", stores: ["LIDL"],
      shopping: expect.objectContaining({ maxStores: 1, confirmedCouponOffers: [] }), locale: "pl", dayCount: 7 }));
  });
  test("saves an optional amount and explicit permission to split shopping", async () => {
    const onCreate = vi.fn();
    render(<LanguageProvider initialLocale="pl"><MealPlanForm busy={false} onCreate={onCreate} /></LanguageProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Utwórz jadłospis" })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Orientacyjna kwota (PLN, opcjonalnie)"), { target: { value: "250.50" } });
    fireEvent.click(screen.getByLabelText("Biedronka"));
    fireEvent.click(screen.getByLabelText("Zgadzam się na zakupy w dwóch sklepach"));
    fireEvent.click(screen.getByRole("button", { name: "Utwórz jadłospis" }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ budget: 250.5, budgetMode: "SOFT", stores: ["LIDL", "BIEDRONKA"], shopping: expect.objectContaining({ maxStores: 2 }) }));
  });
  test("starts a durable week job with an idempotent request instead of scheduling browser AI calls", async () => {
    vi.mocked(api.startWeekGeneration).mockResolvedValue({ id: "job", planId: "plan-1", status: "QUEUED", completed: 0, total: 2, error: null });
    renderPlanner(); fireEvent.click(await screen.findByRole("button", { name: "Generate missing meals" }));
    await waitFor(() => expect(api.startWeekGeneration).toHaveBeenCalledOnce());
    expect(api.generatePlanSlot).not.toHaveBeenCalled();
    expect(await screen.findByText("Week progress: 0/2 · Queued")).toBeVisible();
    expect(screen.getByRole("button", { name: "Generate missing meals" })).toBeDisabled();
  });
  test("returning to a running week restores progress and prevents concurrent edits", async () => {
    vi.mocked(api.getWeekGeneration).mockResolvedValue({ id: "job", planId: "plan-1", status: "RUNNING", completed: 1, total: 2, error: null });
    renderPlanner();
    expect(await screen.findByText("Week progress: 1/2 · Planning")).toBeVisible();
    expect(screen.getByRole("button", { name: "Generate missing meals" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Skip meal" })[0]).toBeDisabled();
  });
  test("a failed week keeps saved dishes and allows retry of missing meals", async () => {
    const partial = fixture(); partial.version = 3; partial.plan.slots[0].recipe = recipe;
    vi.mocked(api.getMealPlan).mockResolvedValue(partial);
    vi.mocked(api.getWeekGeneration).mockResolvedValue({ id: "job", planId: "plan-1", status: "FAILED", completed: 1, total: 2, error: "GENERATION_STOPPED" });
    renderPlanner();
    expect(await screen.findByText("Rice bowl")).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("Saved meals are safe");
    expect(screen.getByRole("button", { name: "Generate missing meals" })).toBeEnabled();
  });

  test("locked meals cannot be swapped or have their portions changed", async () => {
    const locked = fixture(); locked.plan.slots[0].recipe = recipe; locked.plan.slots[0].locked = true;
    vi.mocked(api.getMealPlan).mockResolvedValue(locked);
    renderPlanner();
    expect(await screen.findByRole("button", { name: "Swap meal" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Increase servings" })[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unlock meal" })).toBeEnabled();
  });

  test("accepted plan displays an independent checklist and sends the current version", async () => {
    const accepted = fixture(); accepted.version = 7; accepted.plan.status = "ACCEPTED";
    accepted.plan.slots[0].recipe = recipe;
    accepted.plan.shopping = { calculatedAt: "2026-10-29T10:00:00Z", checkedKeys: [],
      items: [{ key: "rice-key", name: "rice", amount: 200, unit: "g", usedFromFridge: 400, slotIds: ["slot-0"], needsReview: false }] };
    vi.mocked(api.getMealPlan).mockResolvedValue(accepted);
    vi.mocked(api.checkPlanShopping).mockResolvedValue({ ...accepted, version: 8 });
    renderPlanner();
    fireEvent.click(await screen.findByRole("checkbox", { name: "rice" }));
    expect(api.checkPlanShopping).toHaveBeenCalledWith(expect.objectContaining({ version: 7 }), "rice-key", true);
    expect(screen.getByText(/Your manual shopping list is unchanged/)).toBeVisible();
  });
});
