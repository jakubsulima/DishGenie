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
}));
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
  vi.mocked(api.listMealPlans).mockResolvedValue([]);
  vi.mocked(api.getMealPlan).mockResolvedValue(fixture());
});

describe("Meal planner", () => {
  test("saves Lidl, Biedronka, explicit budget and selected meals from the Polish form", () => {
    const onCreate = vi.fn();
    render(<LanguageProvider initialLocale="pl"><MealPlanForm busy={false} onCreate={onCreate} /></LanguageProvider>);
    fireEvent.change(screen.getByLabelText("Budżet na ten plan (PLN)"), { target: { value: "250.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Utwórz jadłospis" }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ budget: 250.5, stores: ["LIDL", "BIEDRONKA"],
      mealTypes: ["LUNCH", "DINNER"], locale: "pl", dayCount: 7 }));
    expect(screen.getByText(/Generowanie posiłków nie optymalizuje jeszcze budżetu/)).toBeVisible();
  });

  test("generates sequentially using each returned version", async () => {
    vi.mocked(api.generatePlanSlot).mockImplementation(async (plan, slotId) => {
      const next = structuredClone(plan); next.version += 2;
      next.plan.slots.find(slot => slot.id === slotId)!.recipe = recipe;
      return next;
    });
    renderPlanner();
    fireEvent.click(await screen.findByRole("button", { name: "Generate missing meals" }));
    await waitFor(() => expect(screen.getAllByText("Rice bowl")).toHaveLength(2));
    expect(vi.mocked(api.generatePlanSlot).mock.calls.map(([plan]) => plan.version)).toEqual([0, 2]);
    expect(screen.getByText(/Generating meals does not guarantee the budget/)).toBeVisible();
  });

  test("keeps saved meals after a partial failure and retries only missing slots", async () => {
    const partial = fixture(); partial.version = 3; partial.plan.slots[0].recipe = recipe;
    vi.mocked(api.generatePlanSlot).mockResolvedValueOnce(partial).mockRejectedValueOnce(new Error("offline"));
    vi.mocked(api.getMealPlan).mockResolvedValueOnce(fixture()).mockResolvedValue(partial);
    renderPlanner();
    fireEvent.click(await screen.findByRole("button", { name: "Generate missing meals" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your saved meals are safe");
    expect(screen.getByText("Rice bowl")).toBeVisible();
    const completed = structuredClone(partial); completed.version = 5; completed.plan.slots[1].recipe = recipe;
    vi.mocked(api.generatePlanSlot).mockResolvedValue(completed);
    await waitFor(() => expect(screen.getByRole("button", { name: "Generate missing meals" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Generate missing meals" }));
    await waitFor(() => expect(vi.mocked(api.generatePlanSlot).mock.calls).toHaveLength(3));
    expect(vi.mocked(api.generatePlanSlot).mock.calls[2][1]).toBe("slot-1");
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
