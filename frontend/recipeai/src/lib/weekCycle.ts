import { apiClient } from './hooks';
import type { MealPlan, PlanRecipe, PlanSettings, PlanShopping, PlanSlot, MealType } from './mealPlans';
export interface WeekException { date: string; mealType: MealType; skipped: boolean; maxMinutes: number | null; cookForNext?: boolean }
export interface Allocation { slotId: string; portions: number; status: 'PLANNED' | 'EATEN' | 'SKIPPED'; eatenPortions?: number }
export interface CookingBatch { id: string; cookingDate: string; recipe: PlanRecipe; portions: number; status: 'PLANNED'|'COOKED'|'CANCELLED'; allocations: Allocation[]; inventoryOperationId: string|null; inventoryReview: boolean; storage: string|null }
export interface Cycle { exceptions: WeekException[]; priorityFridgeIds: number[]; batches: CookingBatch[]; inventoryReview: boolean }
export interface TripLine { id: string; source: string; manualItemId: number|null; requirementKey: string|null; name: string; needed: number|null; fromHome: number; toBuy: number|null; unit: string|null; needsReview: boolean; slotIds: string[]; state: 'NEEDED'|'IN_BASKET'|'UNAVAILABLE'; purchasedAmount: number|null; purchasedUnit: string|null; importToFridge: boolean; importStatus: string|null; actualPrice: number|null; suggestedAmount: number|null; department: string;store:string|null;packages:number|null }
export interface ShoppingTrip { id: string; planId: string|null; version: number; status: string; createdAt: string; trip: {lines: TripLine[]; inventoryOperationId: string|null; completedAt: string|null} }
export interface ChangePreview { id: string; planVersion: number; inventoryFingerprint: string; expiresAt: string; after: MealPlan['plan']; shoppingBefore: PlanShopping; shoppingAfter: PlanShopping; unusedProducts: string[]; affectedSlots: string[] }
export interface CookPreview { batchId: string; version: number; inventoryFingerprint: string; portions: number; changes: {name: string; amount: number; unit: string; fridgeItemId: number}[]; uncovered: PlanShopping; allocations: Allocation[] }

/** Kept until explicitly acknowledged. Retry always uses the original body/version. */
export function durableIntent<T>(scope: string, body: T): { requestId: string; body: T } {
  const key = `recipeai-cycle-intent:${scope}`;
  const prior = localStorage.getItem(key);
  if (prior) return JSON.parse(prior) as {requestId: string; body: T};
  const intent = { requestId: crypto.randomUUID(), body };
  localStorage.setItem(key, JSON.stringify(intent)); return intent;
}
export function clearIntent(scope: string) { localStorage.removeItem(`recipeai-cycle-intent:${scope}`); }
export async function cycleMutation<T>(scope: string, url: string, body: object): Promise<T> {
  const intent = durableIntent(scope, body);
  localStorage.setItem(`recipeai-cycle-pending:${scope}`, JSON.stringify({url, ...intent}));
  try {
    const result = await apiClient<T>(url, true, { ...intent.body, requestId: intent.requestId });
    clearIntent(scope); localStorage.removeItem(`recipeai-cycle-pending:${scope}`); return result;
  } catch (error) {
    const code = error && typeof error === 'object' && 'status' in error ? error.status : null;
    if (code === 409 || code === 400 || code === 404 || code === 422) { clearIntent(scope); localStorage.removeItem(`recipeai-cycle-pending:${scope}`); }
    throw error;
  }
}
export async function startCycle(settings: PlanSettings) {
  const {weekExceptions, priorityFridgeIds, ...serverSettings} = settings;
  delete serverSettings.cyclePreferences;
  const result = await apiClient<{view: MealPlan; generationId: string|null}>('v4/meal-plans/start', true, {
    settings:serverSettings, exceptions:weekExceptions ?? [], priorityFridgeIds:priorityFridgeIds ?? [],
  });
  return result.view;
}
export const shoppingPreview = (id: string) => apiClient<PlanShopping>(`v4/meal-plans/${id}/shopping-preview`);
export const listTrips = () => apiClient<ShoppingTrip[]>('v4/shopping-trips');
export const getTrip = (id: string) => apiClient<ShoppingTrip>(`v4/shopping-trips/${id}`);
export const pendingManual = () => apiClient<{id: number; name: string; amount: number|null; unit: string|null}[]>('v4/shopping-trips/pending-manual');
export const prepareTrip = (plan: MealPlan|null, manualItemIds: number[]) => cycleMutation<ShoppingTrip>(`prepare:${plan?.id ?? 'manual'}`, plan ? `v4/meal-plans/${plan.id}/trips` : 'v4/shopping-trips', { version: plan?.version ?? 0, manualItemIds });
export const changeTripLine = (trip: ShoppingTrip, line: TripLine, state: TripLine['state']) => cycleMutation<ShoppingTrip>(`line:${trip.id}:${line.id}`,`v4/shopping-trips/${trip.id}/lines/${line.id}`,{version:trip.version,state});
export const addTripLine = (trip: ShoppingTrip,name: string,amount: number|null,unit: string|null) => cycleMutation<ShoppingTrip>(`add:${trip.id}`,`v4/shopping-trips/${trip.id}/lines`,{version:trip.version,name,amount,unit});
export interface Purchase {lineId: string; amount: number|null; unit: string|null; importToFridge: boolean; actualPrice: number|null}
export const confirmTrip = (trip: ShoppingTrip,purchases: Purchase[]) => cycleMutation<ShoppingTrip>(`confirm:${trip.id}`,`v4/shopping-trips/${trip.id}/confirm`,{version:trip.version,purchases});
export const retryTripImport = (trip: ShoppingTrip,purchases: Purchase[]) => cycleMutation<ShoppingTrip>(`retry-import:${trip.id}`,`v4/shopping-trips/${trip.id}/retry-import`,{version:trip.version,purchases});
export const undoTripImport = (trip: ShoppingTrip) => cycleMutation<ShoppingTrip>(`undo-import:${trip.id}`,`v4/shopping-trips/${trip.id}/undo-import`,{version:trip.version});
export interface BatchChange {action: 'SHARE'|'MOVE'|'SKIP'|'SERVINGS'|'RECIPE'|'RELEASE'|'STORE'; slotId: string; targetSlotId?: string; portions?: number; recipe?: PlanRecipe; replaceOccupied?: boolean; keepExtra?: boolean; storage?: string}
export const previewChange = (plan: MealPlan,change: BatchChange) => cycleMutation<ChangePreview>(`preview:${plan.id}`,`v4/meal-plans/${plan.id}/change-previews`,{version:plan.version,...change});
export const applyChange = (plan: MealPlan,previewId: string) => cycleMutation<MealPlan>(`apply:${plan.id}:${previewId}`,`v4/meal-plans/${plan.id}/apply-change`,{version:plan.version,previewId});
export const cookingPreview = (plan: MealPlan,batchId: string,portions?: number) => apiClient<CookPreview>(`v4/meal-plans/${plan.id}/batches/${batchId}/preview${portions ? `?portions=${portions}` : ''}`);
export const cookBatch = (plan: MealPlan,preview: CookPreview,updateInventory: boolean) => cycleMutation<MealPlan>(`cook:${plan.id}:${preview.batchId}`,`v4/meal-plans/${plan.id}/batches/${preview.batchId}/cook`,{version:preview.version,portions:preview.portions,inventoryFingerprint:preview.inventoryFingerprint,updateInventory});
export const eatPortions = (plan: MealPlan,slot: PlanSlot) => cycleMutation<MealPlan>(`eat:${plan.id}:${slot.id}`,`v4/meal-plans/${plan.id}/allocations/${slot.id}/eat`,{version:plan.version,portions:slot.servings-(planBatches(plan).flatMap(b=>b.allocations).find(a=>a.slotId===slot.id)?.eatenPortions??0)});
export const undoCooking = (plan: MealPlan,batchId: string) => cycleMutation<MealPlan>(`undo-cook:${plan.id}:${batchId}`,`v4/meal-plans/${plan.id}/batches/${batchId}/undo`,{version:plan.version});
export const getToday = (planId: string,date: string) => apiClient<{date: string; slots: PlanSlot[]; batches: CookingBatch[]; inventoryReview: boolean}>(`v4/meal-plans/${planId}/today?date=${date}`);
export function planBatches(plan: MealPlan): CookingBatch[] {
  const batches = [...(plan.plan.cycle?.batches ?? [])];
  for (const s of plan.plan.slots) if(s.recipe && !s.skipped && !batches.some(b=>b.allocations.some(a=>a.slotId===s.id&&a.status!=="SKIPPED"))) batches.push({id:batches.some(b=>b.id===s.id)&&s.generationId?s.generationId:s.id,cookingDate:s.date,recipe:s.recipe,portions:s.servings,status:'PLANNED',allocations:[{slotId:s.id,portions:s.servings,status:'PLANNED'}],inventoryOperationId:null,inventoryReview:false,storage:null});
  return batches;
}

export async function replayPendingTrip(tripId: string): Promise<ShoppingTrip | null> {
  let latest: ShoppingTrip | null = null;
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('recipeai-cycle-pending:')) continue;
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as {url: string; body: object} | null;
    if (!stored?.url.startsWith(`v4/shopping-trips/${tripId}/`)) continue;
    latest = await cycleMutation<ShoppingTrip>(key.slice('recipeai-cycle-pending:'.length), stored.url, stored.body);
  }
  return latest;
}

export interface ReadyPortions {planId:string;sourceVersion:number;batchId:string;name:string;remaining:number;unallocated:number;storage:string|null}
export interface CycleResources {inventoryFingerprint:string;overlappingPlanIds:string[];readyPortions:ReadyPortions[]}
export const readyPortions=()=>apiClient<ReadyPortions[]>('v4/ready-portions');
export const cycleResources=(planId:string)=>apiClient<CycleResources>(`v4/meal-plans/${planId}/resources`);
export const confirmInventoryReview=(plan:MealPlan,inventoryFingerprint:string)=>cycleMutation<MealPlan>(`inventory-review:${plan.id}`,`v4/meal-plans/${plan.id}/inventory-reviewed`,{version:plan.version,inventoryFingerprint});

export const assignReadyPortions=(plan:MealPlan,source:ReadyPortions,slotId:string,portions:number)=>cycleMutation<MealPlan>(`assign-portions:${plan.id}:${slotId}`,`v4/meal-plans/${plan.id}/ready-portions`,{version:plan.version,sourcePlanId:source.planId,sourceVersion:source.sourceVersion,batchId:source.batchId,slotId,portions});
