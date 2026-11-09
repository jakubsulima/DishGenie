import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { LanguageProvider } from "../src/context/languageContext";
import MealPlanner from "../src/pages/MealPlanner";
import MealPlanForm from "../src/components/MealPlanForm";
import * as api from "../src/lib/mealPlans";
import type { MealPlan, PlanRecipe } from "../src/lib/mealPlans";

vi.mock("../src/context/fridgeContext", async original => ({...await original<typeof import("../src/context/fridgeContext")>(), useFridge: () => ({fridgeItems: [], updateFridgeItem: vi.fn(), removeFridgeItem: vi.fn(), refreshFridgeItems: vi.fn()})}));
vi.mock("../src/lib/weekCycle", async original => ({...await original<typeof import("../src/lib/weekCycle")>(), readyPortions: vi.fn().mockResolvedValue([])}));
vi.mock("../src/lib/mealPlans", async importOriginal => ({
  ...await importOriginal<typeof api>(),
  listMealPlans: vi.fn(), getMealPlan: vi.fn(), createMealPlan: vi.fn(),
  generatePlanSlot: vi.fn(), changePlanSlot: vi.fn(), acceptMealPlan: vi.fn(),
  checkPlanShopping: vi.fn(), refreshPlanShopping: vi.fn(), updatePlanSettings: vi.fn(),
  getShoppingPreferences: vi.fn(), startWeekGeneration: vi.fn(), getWeekGeneration: vi.fn(), cancelWeekGeneration: vi.fn(),
  getPlanningOffers: vi.fn(), replanFromOffers: vi.fn(),
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
const renderPlanner = (entry = "/MealPlanner?plan=plan-1") => render(<LanguageProvider initialLocale="en"><RouterProvider router={createMemoryRouter([{ path: "/MealPlanner", element: <MealPlanner /> }], { initialEntries: [entry] })} /></LanguageProvider>);
const planOptions = () => fireEvent.click(screen.getByLabelText("Plan options"));
const mealOptions = (index = 0) => fireEvent.click(screen.getAllByLabelText("Meal options")[index]);

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  vi.mocked(api.getPlanningOffers).mockImplementation(async plan => ({ version: plan.version, offers: [] }));
  vi.mocked(api.getShoppingPreferences).mockResolvedValue(null);
  vi.mocked(api.getWeekGeneration).mockResolvedValue(null);
  vi.mocked(api.listMealPlans).mockResolvedValue([]);
  vi.mocked(api.getMealPlan).mockResolvedValue(fixture());
});

describe("Meal planner", () => {
  test("uses Polish recipe content even when the interface is in English", async () => {
    const onCreate = vi.fn();
    render(<LanguageProvider initialLocale="en"><MealPlanForm busy={false} onCreate={onCreate} /></LanguageProvider>);
    const create = screen.getByRole("button", { name: "Plan the week" });
    await waitFor(() => expect(create).toBeEnabled()); fireEvent.click(create);
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ locale: "pl" }));
  });
  test("old forced promotion preferences do not override the practical default", async()=>{
    vi.mocked(api.getShoppingPreferences).mockResolvedValue({...fixture().plan.settings, planningMode:"PROMOTIONS_FIRST",cyclePreferences:false});
    const onCreate=vi.fn();render(<LanguageProvider initialLocale="en"><MealPlanForm busy={false} onCreate={onCreate}/></LanguageProvider>);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Plan the week"})).toBeEnabled());fireEvent.click(screen.getByRole("button",{name:"Plan the week"}));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({planningMode:"PRACTICAL"}));
  });
  test("creates a Polish week without a budget and defaults to one store", async () => {
    const onCreate = vi.fn();
    render(<LanguageProvider initialLocale="pl"><MealPlanForm busy={false} onCreate={onCreate} /></LanguageProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Zaplanuj tydzień" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Zaplanuj tydzień" }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ budget: null, budgetMode: "NONE", stores: ["LIDL"],
      shopping: expect.objectContaining({ maxStores: 1, confirmedCouponOffers: [] }), locale: "pl", dayCount: 7 }));
  });
  test("saves an optional amount and explicit permission to split shopping", async () => {
    const onCreate = vi.fn();
    render(<LanguageProvider initialLocale="pl"><MealPlanForm busy={false} onCreate={onCreate} /></LanguageProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Zaplanuj tydzień" })).toBeEnabled());
    fireEvent.click(screen.getByText("Dostosuj"));
    fireEvent.change(screen.getByLabelText("Orientacyjna kwota (PLN, opcjonalnie)"), { target: { value: "250.50" } });
    fireEvent.click(screen.getByLabelText("Biedronka"));
    fireEvent.click(screen.getByLabelText("Zgadzam się na zakupy w dwóch sklepach"));
    fireEvent.click(screen.getByRole("button", { name: "Zaplanuj tydzień" }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ budget: 250.5, budgetMode: "SOFT", stores: ["LIDL", "BIEDRONKA"], shopping: expect.objectContaining({ maxStores: 2 }) }));
  });
  test("starts a durable week job with an idempotent request instead of scheduling browser AI calls", async () => {
    vi.mocked(api.startWeekGeneration).mockResolvedValue({ id: "job", planId: "plan-1", status: "QUEUED", completed: 0, total: 2, error: null });
    renderPlanner(); fireEvent.click(await screen.findByRole("button", { name: /Plan the week|Complete the week/ }));
    await waitFor(() => expect(api.startWeekGeneration).toHaveBeenCalledOnce());
    expect(api.generatePlanSlot).not.toHaveBeenCalled();
    expect(await screen.findByText("Planning meals: 0/2")).toBeVisible();
    expect(screen.getByRole("button", { name: /Plan the week|Complete the week/ })).toBeDisabled();
  });
  test("returning to a running week restores progress and prevents concurrent edits", async () => {
    vi.mocked(api.getWeekGeneration).mockResolvedValue({ id: "job", planId: "plan-1", status: "RUNNING", completed: 1, total: 2, error: null });
    renderPlanner();
    expect(await screen.findByText("Planning meals: 1/2")).toBeVisible();
    expect(screen.getByRole("button", { name: /Plan the week|Complete the week/ })).toBeDisabled();
    mealOptions();
    expect(screen.getByRole("button", { name: "Skip meal" })).toBeDisabled();
  });
  test("a failed week keeps saved dishes and allows retry of missing meals", async () => {
    const partial = fixture(); partial.version = 3; partial.plan.slots[0].recipe = recipe;
    vi.mocked(api.getMealPlan).mockResolvedValue(partial);
    vi.mocked(api.getWeekGeneration).mockResolvedValue({ id: "job", planId: "plan-1", status: "FAILED", completed: 1, total: 2, error: "GENERATION_STOPPED" });
    renderPlanner();
    expect(await screen.findByRole("heading", { name: "Rice bowl", level: 4 })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("Saved meals are safe");
    expect(screen.getByRole("button", { name: /Plan the week|Complete the week/ })).toBeEnabled();
  });

  test("restarting a cancelled queue uses a new request even when no meals were generated", async () => {
    const queued = { id: "job", planId: "plan-1", status: "QUEUED" as const, completed: 0, total: 2, error: null };
    vi.mocked(api.startWeekGeneration).mockImplementation(async (_plan, requestId) => ({ ...queued, id: requestId }));
    vi.mocked(api.cancelWeekGeneration).mockImplementation(async (_id, jobId) => ({ ...queued, id: jobId, status: "CANCELLED" }));
    renderPlanner();
    fireEvent.click(await screen.findByRole("button", { name: /Plan the week|Complete the week/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop after this meal" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Plan the week|Complete the week/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Plan the week|Complete the week/ }));
    await waitFor(() => expect(api.startWeekGeneration).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.startWeekGeneration).mock.calls[1][1]).not.toBe(vi.mocked(api.startWeekGeneration).mock.calls[0][1]);
  });

  test("retrying after a connection failure keeps the request id to avoid duplicate jobs", async () => {
    vi.mocked(api.startWeekGeneration).mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(async (_plan, requestId) => ({ id: requestId, planId: "plan-1", status: "QUEUED", completed: 0, total: 2, error: null }));
    renderPlanner();
    fireEvent.click(await screen.findByRole("button", { name: /Plan the week|Complete the week/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your saved meals are safe");
    await waitFor(() => expect(screen.getByRole("button", { name: /Plan the week|Complete the week/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Plan the week|Complete the week/ }));
    await waitFor(() => expect(api.startWeekGeneration).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.startWeekGeneration).mock.calls[1][1]).toBe(vi.mocked(api.startWeekGeneration).mock.calls[0][1]);
  });

  test("cancellation failures are visible and allow another stop attempt", async () => {
    vi.mocked(api.getWeekGeneration).mockResolvedValue({ id: "job", planId: "plan-1", status: "RUNNING", completed: 0, total: 2, error: null });
    vi.mocked(api.cancelWeekGeneration).mockRejectedValueOnce(new Error("offline"));
    renderPlanner();
    fireEvent.click(await screen.findByRole("button", { name: "Stop after this meal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your saved meals are safe");
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop after this meal" })).toBeEnabled());
    expect(screen.getByText("Planning meals: 0/2")).toBeVisible();
  });

  test("switching plans does not reuse a generation request or leave settings open", async () => {
    const second = fixture(); second.id = "plan-2"; second.plan.settings.requestId = "plan-2";
    vi.mocked(api.getMealPlan).mockImplementation(async id => id === second.id ? second : fixture());
    vi.mocked(api.listMealPlans).mockResolvedValue([fixture(), second].map(p => ({
      id: p.id, version: p.version, startDate: p.plan.settings.startDate, dayCount: 1,
      status: "DRAFT", plannedSlots: 0, totalSlots: 2,
    })));
    vi.mocked(api.startWeekGeneration).mockImplementation(async (plan, requestId) => ({
      id: requestId, planId: plan.id, status: "COMPLETED", completed: 0, total: 0, error: null,
    }));
    renderPlanner();
    fireEvent.click(await screen.findByRole("button", { name: /Plan the week|Complete the week/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Plan the week|Complete the week/ })).toBeEnabled());
    planOptions();
    fireEvent.click(screen.getByRole("button", { name: "Planner settings" }));
    expect(await screen.findByRole("button", { name: "Save planner settings" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    planOptions();
    fireEvent.click(screen.getByRole("button", { name: "Saved meal plans" }));
    fireEvent.click(screen.getAllByRole("button", { name: /2026-10-29 · 0\/2 · Draft/ })[1]);
    const generate = await screen.findByRole("button", { name: /Plan the week|Complete the week/ });
    expect(screen.queryByRole("button", { name: "Save planner settings" })).not.toBeInTheDocument();
    fireEvent.click(generate);
    await waitFor(() => expect(api.startWeekGeneration).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.startWeekGeneration).mock.calls[1][0].id).toBe("plan-2");
    expect(vi.mocked(api.startWeekGeneration).mock.calls[1][1]).not.toBe(vi.mocked(api.startWeekGeneration).mock.calls[0][1]);
  });

  test("removing a loyalty card clears selected offers that may require it", async () => {
    const settings = fixture().plan.settings;
    settings.shopping = { shoppingDate: api.localDateInput(), maxStores: 1, loyaltyStores: ["LIDL"],
      selectedOffers: ["coupon-offer"], confirmedCouponOffers: ["coupon-offer"], allowRepeats: false };
    const onCreate = vi.fn();
    render(<LanguageProvider initialLocale="en"><MealPlanForm initialSettings={settings} busy={false} onCreate={onCreate} /></LanguageProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save planner settings" })).toBeEnabled());
    fireEvent.click(screen.getByText("Customize"));
    fireEvent.click(screen.getByLabelText("Lidl Plus"));
    fireEvent.submit(screen.getByRole("button", { name: "Save planner settings" }).closest("form")!);
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ shopping: expect.objectContaining({
      loyaltyStores: [], confirmedCouponOffers: [], selectedOffers: [],
    }) }));
  });

  test("adding another loyalty card preserves already confirmed offers", async () => {
    const settings = fixture().plan.settings;
    settings.shopping = { shoppingDate: api.localDateInput(), maxStores: 1, loyaltyStores: ["LIDL"],
      selectedOffers: ["coupon-offer"], confirmedCouponOffers: ["coupon-offer"], allowRepeats: false };
    const onCreate = vi.fn();
    render(<LanguageProvider initialLocale="en"><MealPlanForm initialSettings={settings} busy={false} onCreate={onCreate} /></LanguageProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save planner settings" })).toBeEnabled());
    fireEvent.click(screen.getByText("Customize"));
    fireEvent.click(screen.getByLabelText("Moja Biedronka"));
    fireEvent.submit(screen.getByRole("button", { name: "Save planner settings" }).closest("form")!);
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ shopping: expect.objectContaining({
      loyaltyStores: ["LIDL", "BIEDRONKA"], confirmedCouponOffers: ["coupon-offer"], selectedOffers: ["coupon-offer"],
    }) }));
  });

  test("practical plans allow shopping beyond the promotions window", async () => {
    render(<LanguageProvider initialLocale="en"><MealPlanForm busy={false} onCreate={vi.fn()} /></LanguageProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Plan the week" })).toBeEnabled());
    const later = new Date(); later.setDate(later.getDate() + 14);
    const start = new Date(later.getTime() - later.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: start } });
    expect(screen.getByLabelText("Shopping date")).toHaveAttribute("max", start);
    expect(screen.getByLabelText("Start date")).toHaveAttribute("min", api.localDateInput());
  });

  test("settings remain submittable after a saved week has started", async () => {
    const settings = fixture().plan.settings;
    settings.startDate = api.localDateInput(-1);
    settings.shopping = { shoppingDate: settings.startDate, maxStores: 1, loyaltyStores: [],
      selectedOffers: [], confirmedCouponOffers: [], allowRepeats: false };
    const onCreate = vi.fn();
    render(<LanguageProvider initialLocale="en"><MealPlanForm initialSettings={settings} busy={false} onCreate={onCreate} /></LanguageProvider>);
    const save = screen.getByRole("button", { name: "Save planner settings" });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(screen.getByText("Customize"));
    fireEvent.change(screen.getByLabelText("Budget for this plan (PLN)"), { target: { value: "100" } });
    expect(save.closest("form")!.checkValidity()).toBe(true);
    fireEvent.click(save);
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ budget: 100,
      shopping: expect.objectContaining({ shoppingDate: settings.startDate }) }));
  });

  test("older plans without a shopping date do not invent one after the week starts", async () => {
    const settings = fixture().plan.settings;
    settings.startDate = api.localDateInput(-1);
    const onCreate = vi.fn();
    render(<LanguageProvider initialLocale="en"><MealPlanForm initialSettings={settings} busy={false} onCreate={onCreate} /></LanguageProvider>);
    const save = screen.getByRole("button", { name: "Save planner settings" });
    await waitFor(() => expect(save).toBeEnabled());
    expect(save.closest("form")!.checkValidity()).toBe(true);
    fireEvent.click(save);
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      shopping: expect.objectContaining({ shoppingDate: null }) }));
  });

  test("locked meals cannot be swapped or have their portions changed", async () => {
    const locked = fixture(); locked.plan.slots[0].recipe = recipe; locked.plan.slots[0].locked = true;
    vi.mocked(api.getMealPlan).mockResolvedValue(locked);
    renderPlanner();
    expect(await screen.findByRole("button", { name: "Swap" })).toBeDisabled();
    mealOptions();
    expect(screen.getByRole("button", { name: "Increase servings" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Allow replanning" })).toBeEnabled();
  });

  test("accepted plan displays an independent checklist and sends the current version", async () => {
    const accepted = fixture(); accepted.version = 7; accepted.plan.status = "ACCEPTED";
    accepted.plan.slots[0].recipe = recipe;
    accepted.plan.shopping = { calculatedAt: "2026-10-29T10:00:00Z", checkedKeys: [],
      items: [{ key: "rice-key", name: "rice", amount: 200, unit: "g", usedFromFridge: 400, slotIds: ["slot-0"], needsReview: false }] };
    vi.mocked(api.getMealPlan).mockResolvedValue(accepted);
    vi.mocked(api.checkPlanShopping).mockResolvedValue({ ...accepted, version: 8 });
    renderPlanner();
    fireEvent.click(await screen.findByRole("button", { name: "Shopping" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "rice" }));
    expect(api.checkPlanShopping).toHaveBeenCalledWith(expect.objectContaining({ version: 7 }), "rice-key", true);
    expect(screen.getByText(/Your manual shopping list is unchanged/)).toBeVisible();
  });
});

describe("Simplified planner navigation and safeguards", () => {
  const summary = (id: string, startDate: string, dayCount = 7): api.PlanSummary => ({ id, startDate, dayCount, version: 0, status: "DRAFT", plannedSlots: 1, totalSlots: 14 });

  test("chooses the newest current plan, nearest future plan, then newest saved plan", () => {
    const list = [summary("new-future", "2026-12-01"), summary("current-new", "2026-11-05"), summary("current-old", "2026-11-02"), summary("near-future", "2026-11-10")];
    expect(api.preferredMealPlan(list, "2026-11-06")?.id).toBe("current-new");
    expect(api.preferredMealPlan([list[0], list[3], summary("same-start-older", "2026-11-10")], "2026-11-06")?.id).toBe("near-future");
    expect(api.preferredMealPlan(list, "2027-01-01")?.id).toBe("new-future");
    expect(api.preferredMealPlan([summary("month-boundary", "2026-10-31")], "2026-11-06")?.id).toBe("month-boundary");
    expect(api.preferredMealPlan([], "2026-11-06")).toBeUndefined();
  });

  test("ordinary entry opens a saved week but the explicit new-plan path stays separate", async () => {
    vi.mocked(api.listMealPlans).mockResolvedValue([summary("plan-1", api.localDateInput())]);
    const first = renderPlanner("/MealPlanner");
    expect(await screen.findByRole("button", { name: "Plan the week" })).toBeVisible();
    await waitFor(() => expect(api.getMealPlan).toHaveBeenCalledWith("plan-1"));
    first.unmount(); vi.mocked(api.getMealPlan).mockClear();
    renderPlanner("/MealPlanner?new=1");
    expect(await screen.findByRole("button", { name: "Plan the week" })).toBeVisible();
    expect(api.getMealPlan).not.toHaveBeenCalled();
  });

  test("an explicit plan link wins even when the new flag or another current plan exists", async () => {
    vi.mocked(api.listMealPlans).mockResolvedValue([summary("other-plan", api.localDateInput())]);
    renderPlanner("/MealPlanner?plan=plan-1&new=1");
    await screen.findByRole("button", { name: "Plan the week" });
    await waitFor(() => expect(api.getMealPlan).toHaveBeenCalledWith("plan-1"));
    expect(api.getMealPlan).not.toHaveBeenCalledWith("other-plan");
  });

  test("shopping only accepts a partial plan after a conscious click, using its current version", async () => {
    const partial = fixture(); partial.version = 5; partial.plan.slots[0].recipe = recipe;
    vi.mocked(api.getMealPlan).mockResolvedValue(partial);
    vi.mocked(api.acceptMealPlan).mockResolvedValue({ ...partial, version: 6, plan: { ...partial.plan, status: "ACCEPTED", shopping: { calculatedAt: new Date().toISOString(), checkedKeys: [], items: [] } } });
    renderPlanner();
    fireEvent.click(await screen.findByRole("button", { name: "Go to shopping" }));
    expect(api.acceptMealPlan).not.toHaveBeenCalled();
    expect(api.startWeekGeneration).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Accept plan and create shopping list" }));
    await waitFor(() => expect(api.acceptMealPlan).toHaveBeenCalledWith(expect.objectContaining({ version: 5 })));
    expect(await screen.findByRole("button", { name: "Recalculate from fridge" })).toBeVisible();
  });

  test("recipe drafts survive panel closure, another card and the shopping view", async () => {
    const partial = fixture(); partial.plan.slots[0].recipe = recipe; partial.plan.slots[1].recipe = { ...recipe, name: "Soup" };
    vi.mocked(api.getMealPlan).mockResolvedValue(partial);
    renderPlanner();
    await screen.findByRole("heading", { name: "Rice bowl", level: 4 });
    mealOptions(); fireEvent.click(screen.getByRole("button", { name: "Edit recipe" }));
    fireEvent.change(screen.getByLabelText("Recipe name"), { target: { value: "Unfinished correction" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Soup" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Shopping" }));
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    mealOptions(); fireEvent.click(screen.getByRole("button", { name: "Edit recipe" }));
    expect(screen.getByLabelText("Recipe name")).toHaveValue("Unfinished correction");
    expect(api.applyRevision).not.toHaveBeenCalled();
  });

  test("a conflict loads the latest version and keeps the saved recipe", async () => {
    const partial = fixture(); partial.version = 5; partial.plan.slots[0].recipe = recipe;
    vi.mocked(api.getMealPlan).mockResolvedValue(partial);
    vi.mocked(api.startWeekGeneration).mockRejectedValue({ status: 409 });
    renderPlanner();
    fireEvent.click(await screen.findByRole("button", { name: "Complete the week" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("latest saved version");
    expect(screen.getByRole("heading", { name: "Rice bowl", level: 4 })).toBeVisible();
    expect(api.generatePlanSlot).not.toHaveBeenCalled();
  });

  test("a declined discard keeps the unfinished recipe on the current plan", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const partial = fixture(); partial.plan.slots[0].recipe = recipe;
    vi.mocked(api.getMealPlan).mockResolvedValue(partial);
    renderPlanner();
    await screen.findByRole("heading", { name: "Rice bowl", level: 4 });
    mealOptions(); fireEvent.click(screen.getByRole("button", { name: "Edit recipe" }));
    fireEvent.change(screen.getByLabelText("Recipe name"), { target: { value: "Keep my draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    planOptions(); fireEvent.click(screen.getByRole("button", { name: "New plan" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Rice bowl", level: 4 })).toBeVisible();
    mealOptions(); fireEvent.click(screen.getByRole("button", { name: "Edit recipe" }));
    expect(screen.getByLabelText("Recipe name")).toHaveValue("Keep my draft");
  });
});

test("an entirely skipped week stays empty and can restore a meal from its menu", async () => {
  const empty = fixture(); empty.plan.slots.forEach(slot => { slot.skipped = true; });
  const restored = structuredClone(empty); restored.version++; restored.plan.slots[0].skipped = false;
  vi.mocked(api.getMealPlan).mockResolvedValue(empty);
  vi.mocked(api.changePlanSlot).mockResolvedValue(restored);
  renderPlanner();
  expect(await screen.findByRole("button", { name: "Plan the week" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Go to shopping" })).not.toBeInTheDocument();
  mealOptions(); fireEvent.click(screen.getByRole("button", { name: "Restore meal" }));
  expect(api.changePlanSlot).toHaveBeenCalledWith(expect.objectContaining({ version: 0 }), "slot-0", "RESTORE", undefined);
  expect(await screen.findByRole("button", { name: "+ Add meal" })).toBeVisible();
});

test("settings keep their draft and show save errors inside the panel", async () => {
  vi.mocked(api.updatePlanSettings).mockRejectedValueOnce(new Error("offline"));
  const settingsPlan = fixture();
  // Use current dates so browser form validation allows the request.
  settingsPlan.plan.settings.startDate = api.localDateInput();
  settingsPlan.plan.settings.shopping = { shoppingDate: api.localDateInput(), maxStores: 1, loyaltyStores: [], confirmedCouponOffers: [], selectedOffers: [], allowRepeats: false };
  vi.mocked(api.getMealPlan).mockResolvedValue(settingsPlan);
  renderPlanner();
  await screen.findByRole("button", { name: "Plan the week" });
  planOptions(); fireEvent.click(screen.getByRole("button", { name: "Planner settings" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save planner settings" })).toBeEnabled());
  fireEvent.click(screen.getByText("Customize"));
  fireEvent.change(screen.getByLabelText("Budget for this plan (PLN)"), { target: { value: "125" } });
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  planOptions(); fireEvent.click(screen.getByRole("button", { name: "Planner settings" }));
  expect(screen.getByLabelText("Budget for this plan (PLN)")).toHaveValue(125);
  fireEvent.click(screen.getByRole("button", { name: "Save planner settings" }));
  await waitFor(() => expect(api.updatePlanSettings).toHaveBeenCalledOnce());
  const panel = screen.getByRole("dialog", { name: "Planner settings" });
  await waitFor(() => expect(panel.querySelector('[role="alert"]')).toHaveTextContent("Your saved meals are safe"));
  expect(screen.getByLabelText("Budget for this plan (PLN)")).toHaveValue(125);
});
