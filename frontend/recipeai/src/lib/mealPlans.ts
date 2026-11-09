import { durableIntent, clearIntent, cycleMutation } from "./weekCycle";
import axios from "axios";
import { apiClient, ensureCsrfToken } from "./hooks";
import { API_URL } from "./constants";

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER";
export type PlanStore = "LIDL" | "BIEDRONKA";
export interface PlanSettings {
  requestId: string;
  cyclePreferences?: boolean;
  startDate: string;
  dayCount: number;
  servings: number;
  mealTypes: MealType[];
  stores: PlanStore[];
  budget: number | null;
  planningMode?: "PRACTICAL" | "DEALS" | "PROMOTIONS_FIRST";
  budgetMode?: "NONE" | "SOFT";
  shopping?: { shoppingDate: string | null; maxStores: number; loyaltyStores: PlanStore[];
    confirmedCouponOffers: string[]; selectedOffers: string[]; allowRepeats: boolean };
  locale: "pl" | "en";
  maxMinutes: number;
  weekExceptions?: import("./weekCycle").WeekException[];
  priorityFridgeIds?: number[];
}
export interface PlanRecipe {
  locale?: "pl" | "en";
  name: string;
  description: string;
  timeToPrepare: string;
  servings: number;
  ingredients: { name: string; amount: number; unit: string }[];
  instructions: string[];
}
export interface PlanSlot {
  id: string;
  date: string;
  mealType: MealType;
  servings: number;
  locked: boolean;
  skipped: boolean;
  recipe: PlanRecipe | null;
  generationId: string | null;
  generationStatus: "RUNNING" | "COMPLETED" | "FAILED" | null;
  generationStartedAt: string | null;
}
export interface PlanShopping {
  basketOption?: string | null; quote?: import("./planPricing").PlanQuote | null;
  calculatedAt: string;
  checkedKeys: string[];
  items: { key: string; name: string; amount: number | null; unit: string;
    usedFromFridge: number; slotIds: string[]; needsReview: boolean }[];
}
export interface MealPlan {
  id: string;
  version: number;
  createdAt: string;
  plan: { schemaVersion: number; settings: PlanSettings; status: "DRAFT" | "ACCEPTED";
    cycle?: import("./weekCycle").Cycle | null; slots: PlanSlot[]; shopping: PlanShopping | null };
}
export interface PlanSummary {
  id: string;
  version: number;
  startDate: string;
  dayCount: number;
  status: "DRAFT" | "ACCEPTED";
  plannedSlots: number;
  totalSlots: number;
}
const base = "v3/meal-plans";
const planBase = (plan: MealPlan) => plan.plan.schemaVersion >= 4 ? "v4/meal-plans" : base;
export const listMealPlans = async (): Promise<PlanSummary[]> => {
  const summaries: PlanSummary[] = [];
  const seen = new Set<string>();
  for (let page = 0; ; page++) {
    const batch = await apiClient<PlanSummary[]>(page ? `${base}?page=${page}` : base);
    const fresh = batch.filter(item => !seen.has(item.id));
    summaries.push(...fresh); fresh.forEach(item => seen.add(item.id));
    // Also terminate against an older server that ignores the page parameter.
    if (batch.length < 20 || !fresh.length) return summaries;
  }
};
export const getMealPlan = (id: string) => apiClient<MealPlan>(`${base}/${id}`);
export const createMealPlan = (settings: PlanSettings) => apiClient<MealPlan>(base, true, settings);
export const changePlanSlot = (plan: MealPlan, slotId: string,
  action: "LOCK" | "UNLOCK" | "SKIP" | "RESTORE" | "SERVINGS", servings?: number) =>
  apiClient<MealPlan>(`${planBase(plan)}/${plan.id}/slots/${slotId}`, true, { version: plan.version, action, servings });
export const generatePlanSlot = async (plan: MealPlan, slotId: string, requestId: string): Promise<MealPlan> => {
  await ensureCsrfToken();
  try {
    const scope=`generate:${plan.id}:${slotId}`;
    const intent=plan.plan.schemaVersion>=4?durableIntent(scope,{version:plan.version}):null;
    const response = await axios.post<MealPlan>(`${API_URL}${planBase(plan)}/${plan.id}/slots/${slotId}/generate`,
      intent?{...intent.body,requestId:intent.requestId}:{version:plan.version,requestId}, {timeout:240_000});
    if(intent)clearIntent(scope);
    if (!response.data?.plan || response.data.id !== plan.id) throw new Error("Invalid meal plan response");
    return response.data;
  } catch (cause) {
    if(plan.plan.schemaVersion>=4&&axios.isAxiosError(cause)&&[400,404,409,422,429].includes(cause.response?.status??0))clearIntent(`generate:${plan.id}:${slotId}`);
    throw Object.assign(new Error("Meal generation failed"), {
      status: axios.isAxiosError(cause) ? cause.response?.status : undefined,
    });
  }
};
export const acceptMealPlan = (plan: MealPlan) =>
  apiClient<MealPlan>(`${planBase(plan)}/${plan.id}/accept`, true, { version: plan.version });
export const refreshPlanShopping = (plan: MealPlan) =>
  apiClient<MealPlan>(`${planBase(plan)}/${plan.id}/shopping-list/sync`, true, { version: plan.version, requestId: crypto.randomUUID() });
export const checkPlanShopping = (plan: MealPlan, key: string, checked: boolean) =>
  apiClient<MealPlan>(`${planBase(plan)}/${plan.id}/shopping-list/check`, true, { version: plan.version, key, checked });

export const isSlotGenerating = (slot: PlanSlot) => slot.generationStatus === "RUNNING"
  && slot.generationStartedAt !== null && Date.now() - Date.parse(slot.generationStartedAt) < 300_000;

export const localDateInput = (days = 0) => {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export interface GenerationProgress { id: string; planId: string; status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"; completed: number; total: number; error: string | null }
export const startWeekGeneration = (plan: MealPlan, requestId: string) =>
  plan.plan.schemaVersion>=4 ? cycleMutation<GenerationProgress>(`resume:${plan.id}`,`${planBase(plan)}/${plan.id}/generations`,{version:plan.version}) : apiClient<GenerationProgress>(`${planBase(plan)}/${plan.id}/generations`, true, { version: plan.version, requestId });
export const replanFromOffers = (plan: MealPlan, requestId: string) =>
  plan.plan.schemaVersion>=4 ? cycleMutation<GenerationProgress>(`replan:${plan.id}`,`${planBase(plan)}/${plan.id}/replan-from-offers`,{version:plan.version}) : apiClient<GenerationProgress>(`${planBase(plan)}/${plan.id}/replan-from-offers`, true, { version: plan.version, requestId }, { timeoutMs: 60_000 });
export const getPlanningOffers = (plan: Pick<MealPlan, "id" | "version">) =>
  apiClient<{ version: number; offers: import("./planPricing").CatalogOffer[] }>(`${base}/${plan.id}/planning-offers`, false, null, { timeoutMs: 60_000 });
export const getWeekGeneration = (id: string) => apiClient<GenerationProgress | null>(`${base}/${id}/generations/latest`);
export const cancelWeekGeneration = (id: string, jobId: string) => apiClient<GenerationProgress>(`${base}/${id}/generations/${jobId}/cancel`, true, {});
export const getShoppingPreferences = async () => {
  const saved=await apiClient<{settings:PlanSettings|null;cyclePreferences:boolean}>("v4/shopping-preferences");
  return saved.settings?{...saved.settings,cyclePreferences:saved.cyclePreferences}:null;
};
export interface RevisionPreview { id: string; planVersion: number; slotId: string; before: PlanRecipe; after: PlanRecipe; shoppingBefore: PlanShopping; shoppingAfter: PlanShopping; expiresAt: string; quoteBefore?: import("./planPricing").PlanQuote; quoteAfter?: import("./planPricing").PlanQuote; inventoryFingerprint?: string; unusedProducts?: string[]; affectedSlots?: string[] }
export type RevisionIntent = "MANUAL" | "SUBSTITUTE" | "DEAL" | "FASTER" | "SIMPLIFY" | "TRANSLATE_PL";
interface RevisionInput { requestId: string; intent: RevisionIntent; recipe?: PlanRecipe; comment?: string; ingredient?: string; replacement?: string; offerId?: string; maxMinutes?: number }
export const previewRevision = async (plan: MealPlan, slotId: string, input: RevisionInput) => {
  await ensureCsrfToken();
  const scope = `revision:${plan.id}:${slotId}`;
  const intent = plan.plan.schemaVersion >= 4 ? durableIntent(scope,{version:plan.version,...input}) : null;
  try {
    const result = (await axios.post<RevisionPreview>(`${API_URL}${planBase(plan)}/${plan.id}/slots/${slotId}/revision-previews`, intent ? {...intent.body,requestId:intent.requestId} : {version:plan.version,...input}, {timeout:240_000})).data;
    if(intent)clearIntent(scope);return result;
  } catch(error) {
    if(intent&&axios.isAxiosError(error)&&[400,404,409,422,429].includes(error.response?.status??0))clearIntent(scope);
    throw error;
  }
};
export const applyRevision = (plan: MealPlan, slotId: string, previewId: string) => apiClient<MealPlan>(`${planBase(plan)}/${plan.id}/slots/${slotId}/apply-revision`, true, { version: plan.version, previewId });
export const undoRevision = (plan: MealPlan, slotId: string, previewId: string) => apiClient<RevisionPreview>(`${planBase(plan)}/${plan.id}/slots/${slotId}/undo-revision`, true, { version: plan.version, previewId });

export const selectPlanBasket = (plan: MealPlan, option: string, shoppingDate: string, loyaltyStores: PlanStore[]) =>
  apiClient<MealPlan>(`${planBase(plan)}/${plan.id}/shopping-list/select`, true, { version: plan.version, option,
    quote: { version: plan.version, shoppingDate, loyaltyStores, confirmedCouponOffers: plan.plan.settings.shopping?.confirmedCouponOffers ?? [] } });

export const updatePlanSettings = async (plan: MealPlan, settings: PlanSettings) => {
  await ensureCsrfToken();
  return (await axios.patch<MealPlan>(`${API_URL}${planBase(plan)}/${plan.id}/settings`, { version: plan.version, settings })).data;
};

export const latestPlanRevision = (planId: string, slotId: string) => apiClient<{ id?: string }>(`${base}/${planId}/slots/${slotId}/revisions/latest`);

export const reportPlanShoppingIssue = (plan: MealPlan, key: string, reason: "MISSING_PRODUCT" | "PRICE_DIFFERENT", requestId: string) =>
  apiClient<{ id: string }>(`${planBase(plan)}/${plan.id}/shopping-list/issues`, true, { version: plan.version, key, reason, requestId });

// Summaries are returned newest first (createdAt DESC, id DESC). Keep this order
// for overlapping weeks and equal future start dates, without fetching each plan.
export function preferredMealPlan(summaries: PlanSummary[], today = localDateInput()): PlanSummary | undefined {
  const current = summaries.find(summary => {
    const end = new Date(`${summary.startDate}T12:00:00`);
    end.setDate(end.getDate() + summary.dayCount - 1);
    const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    return summary.startDate <= today && endDate >= today;
  });
  return current ?? summaries.filter(summary => summary.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? summaries[0];
}
