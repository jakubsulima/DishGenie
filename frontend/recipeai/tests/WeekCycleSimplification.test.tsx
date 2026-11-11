import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { LanguageProvider } from '../src/context/languageContext';
import WeekCycleWorkspace from '../src/components/WeekCycleWorkspace';
import ShoppingTripPanel from '../src/components/ShoppingTripPanel';
import MealPlanForm from '../src/components/MealPlanForm';
import type { MealPlan, PlanRecipe } from '../src/lib/mealPlans';
import * as cycle from '../src/lib/weekCycle';
import * as plans from '../src/lib/mealPlans';

vi.mock('../src/context/fridgeContext', async original => ({ ...await original<typeof import('../src/context/fridgeContext')>(), useFridge: () => ({ fridgeItems: [], updateFridgeItem: vi.fn(), removeFridgeItem: vi.fn(), refreshFridgeItems: vi.fn().mockResolvedValue(undefined) }) }));
vi.mock('../src/lib/weekCycle', async original => ({ ...await original<typeof cycle>(), shoppingPreview: vi.fn(), listTrips: vi.fn(), pendingManual: vi.fn(), cycleResources: vi.fn(), previewChange: vi.fn(), applyChange: vi.fn(), replayPendingTrip: vi.fn(), confirmTrip: vi.fn(), readyPortions: vi.fn() }));
vi.mock('../src/lib/mealPlans', async original => ({ ...await original<typeof plans>(), getShoppingPreferences: vi.fn() }));
vi.mock('../src/lib/planPricing', () => ({ getOffers: vi.fn().mockResolvedValue({ offers: [], sourceStatus: 'MANUAL_REVIEW_ONLY' }) }));
vi.mock('../src/components/MealPlanPricing', () => ({ default: () => null }));
vi.mock('../src/lib/posthog', () => ({ captureEvent: vi.fn() }));

const recipe: PlanRecipe = { name: 'Rice bowl', description: 'Rice and vegetables', timeToPrepare: '20 min', servings: 2, ingredients: [{ name: 'rice', amount: 300, unit: 'g' }], instructions: ['Cook rice.'] };
const shopping = { calculatedAt: '2026-11-08T10:00:00Z', checkedKeys: [], items: [{ key: 'rice', name: 'rice', amount: 300, unit: 'g', usedFromFridge: 0, slotIds: ['slot'], needsReview: false }] };
const plan: MealPlan = { id: 'plan', version: 1, createdAt: '2026-11-08T10:00:00Z', plan: { schemaVersion: 4, status: 'DRAFT', settings: { requestId: 'request', startDate: '2026-11-09', dayCount: 1, servings: 2, mealTypes: ['LUNCH'], stores: ['LIDL'], budget: null, locale: 'en', maxMinutes: 45 }, slots: [{ id: 'slot', date: '2026-11-09', mealType: 'LUNCH', servings: 2, locked: false, skipped: false, recipe, generationId: null, generationStatus: null, generationStartedAt: null }], shopping, cycle: { exceptions: [], priorityFridgeIds: [], inventoryReview: false, batches: [{ id: 'batch', recipe, cookingDate: '2026-11-09', portions: 2, status: 'PLANNED', allocations: [{ slotId: 'slot', portions: 2, status: 'PLANNED' }], inventoryOperationId: null, inventoryReview: false, storage: null }] } } };
const trip: cycle.ShoppingTrip = { id: 'trip', version: 1, planId: 'plan', status: 'IN_PROGRESS', createdAt: '2026-11-08T10:00:00Z', trip: { inventoryOperationId: null, completedAt: null, lines: [{ id: 'line', source: 'PLAN', manualItemId: null, requirementKey: 'rice', name: 'rice', needed: 400, fromHome: 0, toBuy: 400, unit: 'g', needsReview: false, slotIds: ['slot'], state: 'IN_BASKET', purchasedAmount: null, purchasedUnit: null, importToFridge: false, importStatus: null, actualPrice: null, suggestedAmount: 500, department: 'DRY', store: 'LIDL', packages: 1 }] } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cycle.shoppingPreview).mockResolvedValue(shopping);
  vi.mocked(cycle.listTrips).mockResolvedValue([]);
  vi.mocked(cycle.pendingManual).mockResolvedValue([]);
  vi.mocked(cycle.cycleResources).mockResolvedValue({ inventoryFingerprint: 'stock', overlappingPlanIds: [], readyPortions: [] });
  vi.mocked(cycle.readyPortions).mockResolvedValue([]);
  vi.mocked(cycle.replayPendingTrip).mockResolvedValue(null);
  vi.mocked(plans.getShoppingPreferences).mockResolvedValue(null);
});

function renderWeek(entry = '/MealPlanner?plan=plan') {
  return render(<LanguageProvider initialLocale="en"><MemoryRouter initialEntries={[entry]}><WeekCycleWorkspace plan={plan} onSaved={vi.fn()} onGenerate={vi.fn()} onResume={vi.fn()} onStop={vi.fn()} jobRunning={false} progress="" busy={false} onNextWeek={vi.fn()} onDraftChange={vi.fn()} onBusyChange={vi.fn()} /></MemoryRouter></LanguageProvider>);
}

test('legacy today link opens the week and meal actions stay in one menu', async () => {
  renderWeek('/MealPlanner?plan=plan&view=today');
  await screen.findByRole('button', { name: 'Go to shopping' });
  expect(within(screen.getByRole('navigation', { name: 'Plan views' })).getAllByRole('button').map(button => button.textContent)).toEqual(['Week', 'Shopping']);
  expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByRole('button', { name: 'Cook for two days' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mark as cooked' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Meal options' }));
  expect(screen.getByRole('button', { name: 'Cook for two days' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Mark as cooked' })).toBeVisible();
});

test('swap shows the proposed recipe before applying and hides unchanged shopping rows', async () => {
  const afterRecipe = { ...recipe, name: 'Vegetable rice', description: 'A different dinner', instructions: ['Steam the vegetables.'] };
  vi.mocked(cycle.previewChange).mockResolvedValue({ id: 'preview', planVersion: 1, inventoryFingerprint: 'stock', expiresAt: '2026-11-09T10:00:00Z', after: { ...plan.plan, slots: [{ ...plan.plan.slots[0], recipe: afterRecipe }] }, shoppingBefore: shopping, shoppingAfter: shopping, unusedProducts: [], affectedSlots: ['slot'] });
  renderWeek();
  fireEvent.click(screen.getByRole('button', { name: 'Swap' }));
  const dialog = await screen.findByRole('dialog', { name: 'Change and shopping impact' });
  expect(within(dialog).getByRole('heading', { name: 'Vegetable rice' })).toBeVisible();
  expect(within(dialog).getByText('Before: Rice bowl')).toBeVisible();
  expect(within(dialog).getByText('Shopping requirements are unchanged.')).toBeVisible();
  expect(cycle.applyChange).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByText('Recipe details'));
  expect(within(dialog).getByText('Steam the vegetables.')).toBeVisible();
});

test('purchase confirmation starts compact and submits corrected quantities and the explicit fridge choice', async () => {
  vi.mocked(cycle.confirmTrip).mockResolvedValue({ ...trip, version: 2, status: 'COMPLETED' });
  render(<LanguageProvider initialLocale="en"><MemoryRouter><ShoppingTripPanel trip={trip} onSaved={vi.fn()} /></MemoryRouter></LanguageProvider>);
  expect(screen.getByRole('checkbox', { name: /rice/ })).toHaveAccessibleName(/500 g/);
  fireEvent.click(screen.getByRole('button', { name: 'Finish shopping' }));
  const dialog = screen.getByRole('dialog', { name: 'Confirm actual purchases' });
  expect(within(dialog).getByText('rice · 500 g')).toBeVisible();
  expect(within(dialog).getByLabelText('Amount')).not.toBeVisible();
  fireEvent.click(within(dialog).getByText('Edit purchase'));
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Amount' }), { target: { value: '750' } });
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Add to fridge' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm purchases' }));
  await waitFor(() => expect(cycle.confirmTrip).toHaveBeenCalledWith(trip, [{ lineId: 'line', amount: 750, unit: 'g', importToFridge: false, actualPrice: null }]));
});

test('exceptions show one selected day and retain edits when another day is selected', async () => {
  const onCreate = vi.fn();
  render(<LanguageProvider initialLocale="en"><MealPlanForm busy={false} onCreate={onCreate} /></LanguageProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Plan the week' })).toBeEnabled());
  expect(screen.queryByText('Choose a day to adjust its meals.')).not.toBeVisible();
  fireEvent.click(screen.getByText('Customize'));
  fireEvent.click(screen.getByText('Exceptions this week'));
  expect(screen.queryByRole('spinbutton', { name: 'Time limit for this meal' })).not.toBeInTheDocument();
  const exceptions = screen.getByText('Choose a day to adjust its meals.').parentElement!;
  const days = within(exceptions).getAllByRole('button');
  fireEvent.click(days[0]);
  expect(screen.getAllByRole('spinbutton', { name: 'Time limit for this meal' })).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('checkbox', { name: /Away from home/ })[0]);
  fireEvent.click(days[1]);
  fireEvent.change(screen.getAllByRole('spinbutton', { name: 'Time limit for this meal' })[0], { target: { value: '15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Plan the week' }));
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ weekExceptions: [expect.objectContaining({ skipped: true }), expect.objectContaining({ maxMinutes: 15 })] }));
});
