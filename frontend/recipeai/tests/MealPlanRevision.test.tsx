import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { LanguageProvider } from "../src/context/languageContext";
import MealPlanRevision from "../src/components/MealPlanRevision";
import * as api from "../src/lib/mealPlans";
vi.mock("../src/lib/mealPlans", () => ({ latestPlanRevision: vi.fn().mockResolvedValue({}), previewRevision: vi.fn(), applyRevision: vi.fn(), undoRevision: vi.fn() }));
vi.mock("../src/lib/planPricing", () => ({ getOffers: vi.fn().mockResolvedValue({ offers: [] }) }));
const recipe: api.PlanRecipe = { name: "Ryż", description: "", timeToPrepare: "20 min", servings: 2, ingredients: [{ name: "ryż", amount: 100, unit: "g" }], instructions: ["Ugotuj ryż."] };
const slot: api.PlanSlot = { id: "slot", date: "2026-11-03", mealType: "DINNER", servings: 2, locked: false, skipped: false, recipe, generationId: null, generationStatus: null, generationStartedAt: null };
const plan: api.MealPlan = { id: "plan", version: 5, createdAt: "2026-11-03T10:00:00Z", plan: { schemaVersion: 2, status: "DRAFT", slots: [slot], shopping: null, settings: { requestId: "plan", startDate: slot.date, dayCount: 1, servings: 2, mealTypes: ["DINNER"], stores: ["LIDL"], budget: null, locale: "pl", maxMinutes: 45 } } };
const shopping: api.PlanShopping = { calculatedAt: plan.createdAt, checkedKeys: [], items: [{ key: "rice", name: "ryż", amount: 100, unit: "g", usedFromFridge: 0, slotIds: [slot.id], needsReview: false }] };
const preview: api.RevisionPreview = { id: "preview", planVersion: 5, slotId: "slot", before: recipe, after: { ...recipe, name: "Mniej ryżu" }, shoppingBefore: shopping, shoppingAfter: { ...shopping, items: [{ ...shopping.items[0], amount: 50 }] }, expiresAt: new Date(Date.now() + 900000).toISOString() };
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, "confirm").mockReturnValue(true); });
test("an English recipe can be translated into Polish with a preview before applying", async () => {
  const english = { ...recipe, name: "Sichuan rice", description: "Rice with seasoning.", locale: "en" as const };
  const englishSlot = { ...slot, recipe: english };
  const englishPlan = { ...plan, plan: { ...plan.plan, slots: [englishSlot], settings: { ...plan.plan.settings, locale: "en" as const } } };
  vi.mocked(api.previewRevision).mockResolvedValue({ ...preview, before: english, after: { ...recipe, name: "Ryż po syczuańsku", description: "Ryż z przyprawami kuchni syczuańskiej.", locale: "pl" } });
  render(<LanguageProvider initialLocale="pl"><MealPlanRevision plan={englishPlan} slot={englishSlot} disabled={false} onApplied={vi.fn()} /></LanguageProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Edytuj przepis" }));
  fireEvent.change(screen.getByLabelText("Rodzaj poprawki"), { target: { value: "TRANSLATE_PL" } });
  expect(screen.getByText(/Ilości i liczba porcji pozostają takie same/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Podgląd zmiany" }));
  expect(await screen.findByText("Sichuan rice → Ryż po syczuańsku")).toBeVisible();
  expect(screen.getByText("Ryż z przyprawami kuchni syczuańskiej.")).toBeVisible();
  expect(api.previewRevision).toHaveBeenCalledWith(englishPlan, slot.id, expect.objectContaining({ intent: "TRANSLATE_PL" }));
  expect(api.applyRevision).not.toHaveBeenCalled();
});
test("manual corrections show instructions and shopping before applying, then offer undo", async () => {
  vi.mocked(api.previewRevision).mockResolvedValue(preview); vi.mocked(api.applyRevision).mockResolvedValue({ ...plan, version: 6 }); vi.mocked(api.undoRevision).mockResolvedValue({ ...preview, id: "undo", planVersion: 6 });
  const onApplied = vi.fn(); render(<LanguageProvider initialLocale="pl"><MealPlanRevision plan={plan} slot={slot} disabled={false} onApplied={onApplied} /></LanguageProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Edytuj przepis" }));
  fireEvent.change(screen.getByLabelText("Ilość 1"), { target: { value: "50" } });
  fireEvent.change(screen.getByLabelText("Przygotowanie (jeden krok w wierszu)"), { target: { value: "Ugotuj mniej ryżu." } });
  fireEvent.click(screen.getByRole("button", { name: "Podgląd zmiany" }));
  expect(await screen.findByText("Zakupy po zmianie: ryż: 50 g")).toBeVisible();
  expect(api.applyRevision).not.toHaveBeenCalled();
  expect(api.previewRevision).toHaveBeenCalledWith(plan, "slot", expect.objectContaining({ intent: "MANUAL", recipe: expect.objectContaining({ instructions: ["Ugotuj mniej ryżu."] }) }));
  fireEvent.click(screen.getByRole("button", { name: "Zastosuj poprawkę" }));
  await waitFor(() => expect(onApplied).toHaveBeenCalledWith(expect.objectContaining({ version: 6 })));
  expect(screen.getByRole("button", { name: "Podgląd cofnięcia" })).toBeVisible();
});
test("a locked meal cannot start a revision", () => {
  render(<LanguageProvider initialLocale="pl"><MealPlanRevision plan={plan} slot={{ ...slot, locked: true }} disabled={false} onApplied={vi.fn()} /></LanguageProvider>);
  expect(screen.getByRole("button", { name: "Edytuj przepis" })).toBeDisabled();
});

test.each([
  ["quantity", () => fireEvent.change(screen.getByLabelText("Ilość 1"), { target: { value: "75" } })],
  ["instructions", () => fireEvent.change(screen.getByLabelText("Przygotowanie (jeden krok w wierszu)"), { target: { value: "Ugotuj 75 g ryżu." } })],
  ["name", () => fireEvent.change(screen.getByLabelText("Nazwa dania"), { target: { value: "Inne danie" } })],
  ["ingredient", () => fireEvent.change(screen.getByLabelText("Składnik 1"), { target: { value: "brokuł" } })],
  ["unit", () => fireEvent.change(screen.getByLabelText("Jednostka 1"), { target: { value: "kg" } })],
  ["added ingredient", () => fireEvent.click(screen.getByRole("button", { name: "Dodaj składnik" }))],
  ["removed ingredient", () => fireEvent.click(screen.getByRole("button", { name: "Usuń składnik 1" }))],
] as const)("editing %s invalidates the existing preview", async (_, edit) => {
  vi.mocked(api.previewRevision).mockResolvedValue(preview);
  render(<LanguageProvider initialLocale="pl"><MealPlanRevision plan={plan} slot={slot} disabled={false} onApplied={vi.fn()} /></LanguageProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Edytuj przepis" }));
  fireEvent.click(screen.getByRole("button", { name: "Podgląd zmiany" }));
  expect(await screen.findByRole("button", { name: "Zastosuj poprawkę" })).toBeVisible();
  edit();
  expect(screen.queryByRole("button", { name: "Zastosuj poprawkę" })).not.toBeInTheDocument();
  expect(api.applyRevision).not.toHaveBeenCalled();
});

test("after changing 50 g to 75 g only the new preview can be applied", async () => {
  const first = { ...preview, after: { ...recipe, ingredients: [{ ...recipe.ingredients[0], amount: 50 }] } };
  const next = { ...preview, id: "preview-75", after: { ...recipe, ingredients: [{ ...recipe.ingredients[0], amount: 75 }] } };
  vi.mocked(api.previewRevision).mockResolvedValueOnce(first).mockResolvedValueOnce(next);
  vi.mocked(api.applyRevision).mockResolvedValue({ ...plan, version: 6 });
  render(<LanguageProvider initialLocale="pl"><MealPlanRevision plan={plan} slot={slot} disabled={false} onApplied={vi.fn()} /></LanguageProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Edytuj przepis" }));
  fireEvent.change(screen.getByLabelText("Ilość 1"), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: "Podgląd zmiany" }));
  await screen.findByRole("button", { name: "Zastosuj poprawkę" });
  fireEvent.change(screen.getByLabelText("Ilość 1"), { target: { value: "75" } });
  expect(screen.queryByRole("button", { name: "Zastosuj poprawkę" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Podgląd zmiany" }));
  fireEvent.click(await screen.findByRole("button", { name: "Zastosuj poprawkę" }));
  await waitFor(() => expect(api.applyRevision).toHaveBeenCalledWith(plan, "slot", "preview-75"));
  expect(api.previewRevision).toHaveBeenLastCalledWith(plan, "slot", expect.objectContaining({ recipe: expect.objectContaining({ ingredients: [{ name: "ryż", amount: 75, unit: "g" }] }) }));
});
test("an obsolete in-flight preview cannot reappear after a field change", async () => {
  let resolve!: (result: api.RevisionPreview) => void;
  vi.mocked(api.previewRevision).mockReturnValueOnce(new Promise<api.RevisionPreview>(finish => { resolve = finish; }));
  render(<LanguageProvider initialLocale="pl"><MealPlanRevision plan={plan} slot={slot} disabled={false} onApplied={vi.fn()} /></LanguageProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Edytuj przepis" }));
  fireEvent.click(screen.getByRole("button", { name: "Podgląd zmiany" }));
  expect(screen.getByLabelText("Ilość 1")).toBeDisabled();
  // Exercise the response guard even if a non-interactive update changes an input while disabled.
  fireEvent.change(screen.getByLabelText("Ilość 1"), { target: { value: "75" } });
  await act(async () => { resolve(preview); });
  expect(screen.queryByRole("button", { name: "Zastosuj poprawkę" })).not.toBeInTheDocument();
});

test("an editor opened before a meal swap cannot submit the old recipe against the new plan", async () => {
  vi.mocked(api.previewRevision).mockResolvedValue(preview);
  const show = (currentPlan: api.MealPlan, currentSlot: api.PlanSlot) => <LanguageProvider initialLocale="pl"><MealPlanRevision plan={currentPlan} slot={currentSlot} disabled={false} onApplied={vi.fn()} /></LanguageProvider>;
  const { rerender } = render(show(plan, slot));
  fireEvent.click(screen.getByRole("button", { name: "Edytuj przepis" }));
  fireEvent.change(screen.getByLabelText("Nazwa dania"), { target: { value: "Moja niezapisana poprawka" } });
  const replacement = { ...recipe, name: "Nowe danie" };
  const swappedSlot = { ...slot, recipe: replacement };
  const swappedPlan = { ...plan, version: 7, plan: { ...plan.plan, slots: [swappedSlot] } };
  rerender(show(swappedPlan, swappedSlot));
  expect(screen.getByRole("alert")).toHaveTextContent("Twój szkic został zachowany");
  expect(screen.getByLabelText("Nazwa dania")).toHaveValue("Moja niezapisana poprawka");
  expect(screen.getByRole("button", { name: "Podgląd zmiany" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Podgląd zmiany" }));
  expect(api.previewRevision).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Edytuj przepis" }));
  expect(screen.getByLabelText("Nazwa dania")).toHaveValue("Nowe danie");
  expect(screen.getByRole("button", { name: "Podgląd zmiany" })).toBeEnabled();
  await act(async () => {});
});

test("checking shopping items does not invalidate an unfinished recipe correction", async () => {
  const show = (current: api.MealPlan) => <LanguageProvider initialLocale="pl"><MealPlanRevision plan={current} slot={slot} disabled={false} onApplied={vi.fn()} /></LanguageProvider>;
  const { rerender } = render(show(plan));
  fireEvent.click(screen.getByRole("button", { name: "Edytuj przepis" }));
  fireEvent.change(screen.getByLabelText("Nazwa dania"), { target: { value: "Moja poprawka" } });
  rerender(show({ ...plan, version: plan.version + 1 }));
  expect(screen.getByLabelText("Nazwa dania")).toHaveValue("Moja poprawka");
  expect(screen.getByRole("button", { name: "Podgląd zmiany" })).toBeEnabled();
  await act(async () => {});
});

test("undo can be previewed and applied after the parent renders the revised meal", async () => {
  vi.mocked(api.previewRevision).mockResolvedValue(preview);
  const revisedSlot = { ...slot, recipe: preview.after };
  const revisedPlan = { ...plan, version: 6, plan: { ...plan.plan, slots: [revisedSlot] } };
  vi.mocked(api.applyRevision).mockResolvedValue(revisedPlan);
  vi.mocked(api.undoRevision).mockResolvedValue({ ...preview, id: "undo", planVersion: 6, before: preview.after, after: recipe });
  const show = (current: api.MealPlan, currentSlot: api.PlanSlot) => <LanguageProvider initialLocale="pl"><MealPlanRevision plan={current} slot={currentSlot} disabled={false} onApplied={vi.fn()} /></LanguageProvider>;
  const { rerender } = render(show(plan, slot));
  fireEvent.click(screen.getByRole("button", { name: "Edytuj przepis" }));
  fireEvent.click(screen.getByRole("button", { name: "Podgląd zmiany" }));
  fireEvent.click(await screen.findByRole("button", { name: "Zastosuj poprawkę" }));
  await waitFor(() => expect(api.applyRevision).toHaveBeenCalledOnce());
  rerender(show(revisedPlan, revisedSlot));
  fireEvent.click(screen.getByRole("button", { name: "Podgląd cofnięcia" }));
  const applyUndo = await screen.findByRole("button", { name: "Zastosuj poprawkę" });
  expect(applyUndo).toBeEnabled();
  fireEvent.click(applyUndo);
  await waitFor(() => expect(api.applyRevision).toHaveBeenLastCalledWith(revisedPlan, slot.id, "undo"));
});
