import axios from "axios";
import { apiClient, ensureCsrfToken } from "./hooks";
import { API_URL } from "./constants";

export type MealType = "LUNCH" | "DINNER";
export type PlanStore = "LIDL" | "BIEDRONKA";
export interface PlanSettings {
  requestId: string;
  startDate: string;
  dayCount: number;
  servings: number;
  mealTypes: MealType[];
  stores: PlanStore[];
  budget: number | null;
  planningMode?: "DEALS";
  budgetMode?: "NONE" | "SOFT";
  shopping?: { shoppingDate: string | null; maxStores: number; loyaltyStores: PlanStore[];
    confirmedCouponOffers: string[]; selectedOffers: string[]; allowRepeats: boolean };
  locale: "pl" | "en";
  maxMinutes: number;
}
export interface PlanRecipe {
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
    slots: PlanSlot[]; shopping: PlanShopping | null };
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
export const listMealPlans = () => apiClient<PlanSummary[]>(base);
export const getMealPlan = (id: string) => apiClient<MealPlan>(`${base}/${id}`);
export const createMealPlan = (settings: PlanSettings) => apiClient<MealPlan>(base, true, settings);
export const changePlanSlot = (plan: MealPlan, slotId: string,
  action: "LOCK" | "UNLOCK" | "SKIP" | "RESTORE" | "SERVINGS", servings?: number) =>
  apiClient<MealPlan>(`${base}/${plan.id}/slots/${slotId}`, true, { version: plan.version, action, servings });
export const generatePlanSlot = async (plan: MealPlan, slotId: string, requestId: string): Promise<MealPlan> => {
  await ensureCsrfToken();
  try {
    const response = await axios.post<MealPlan>(`${API_URL}${base}/${plan.id}/slots/${slotId}/generate`,
      { version: plan.version, requestId }, { timeout: 240_000 });
    if (!response.data?.plan || response.data.id !== plan.id) throw new Error("Invalid meal plan response");
    return response.data;
  } catch (cause) {
    throw Object.assign(new Error("Meal generation failed"), {
      status: axios.isAxiosError(cause) ? cause.response?.status : undefined,
    });
  }
};
export const acceptMealPlan = (plan: MealPlan) =>
  apiClient<MealPlan>(`${base}/${plan.id}/accept`, true, { version: plan.version });
export const refreshPlanShopping = (plan: MealPlan) =>
  apiClient<MealPlan>(`${base}/${plan.id}/shopping-list/sync`, true, { version: plan.version, requestId: crypto.randomUUID() });
export const checkPlanShopping = (plan: MealPlan, key: string, checked: boolean) =>
  apiClient<MealPlan>(`${base}/${plan.id}/shopping-list/check`, true, { version: plan.version, key, checked });

export const isSlotGenerating = (slot: PlanSlot) => slot.generationStatus === "RUNNING"
  && slot.generationStartedAt !== null && Date.now() - Date.parse(slot.generationStartedAt) < 300_000;

export const localDateInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export interface GenerationProgress { id: string; planId: string; status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"; completed: number; total: number; error: string | null }
export const startWeekGeneration = (plan: MealPlan, requestId: string) =>
  apiClient<GenerationProgress>(`${base}/${plan.id}/generations`, true, { version: plan.version, requestId });
export const getWeekGeneration = (id: string) => apiClient<GenerationProgress | null>(`${base}/${id}/generations/latest`);
export const cancelWeekGeneration = (id: string, jobId: string) => apiClient<GenerationProgress>(`${base}/${id}/generations/${jobId}/cancel`, true, {});
export const getShoppingPreferences = () => apiClient<PlanSettings | null>("v2/shopping-preferences");
export interface RevisionPreview { id: string; planVersion: number; slotId: string; before: PlanRecipe; after: PlanRecipe; shoppingBefore: PlanShopping; shoppingAfter: PlanShopping; expiresAt: string; quoteBefore?: import("./planPricing").PlanQuote; quoteAfter?: import("./planPricing").PlanQuote }
export type RevisionIntent = "MANUAL" | "SUBSTITUTE" | "DEAL" | "FASTER" | "SIMPLIFY";
export interface RevisionInput { requestId: string; intent: RevisionIntent; recipe?: PlanRecipe; comment?: string; ingredient?: string; replacement?: string; offerId?: string; maxMinutes?: number }
export const previewRevision = async (plan: MealPlan, slotId: string, input: RevisionInput) => {
  await ensureCsrfToken();
  return (await axios.post<RevisionPreview>(`${API_URL}${base}/${plan.id}/slots/${slotId}/revision-previews`, { version: plan.version, ...input }, { timeout: 240_000 })).data;
};
export const applyRevision = (plan: MealPlan, slotId: string, previewId: string) => apiClient<MealPlan>(`${base}/${plan.id}/slots/${slotId}/apply-revision`, true, { version: plan.version, previewId });
export const undoRevision = (plan: MealPlan, slotId: string, previewId: string) => apiClient<RevisionPreview>(`${base}/${plan.id}/slots/${slotId}/undo-revision`, true, { version: plan.version, previewId });

export const selectPlanBasket = (plan: MealPlan, option: string, shoppingDate: string, loyaltyStores: PlanStore[]) =>
  apiClient<MealPlan>(`${base}/${plan.id}/shopping-list/select`, true, { version: plan.version, option,
    quote: { version: plan.version, shoppingDate, loyaltyStores, confirmedCouponOffers: plan.plan.settings.shopping?.confirmedCouponOffers ?? [] } });

export const updatePlanSettings = async (plan: MealPlan, settings: PlanSettings) => {
  await ensureCsrfToken();
  return (await axios.patch<MealPlan>(`${API_URL}${base}/${plan.id}/settings`, { version: plan.version, settings })).data;
};

export const latestPlanRevision = (planId: string, slotId: string) => apiClient<{ id?: string }>(`${base}/${planId}/slots/${slotId}/revisions/latest`);

export const reportPlanShoppingIssue = (plan: MealPlan, key: string, reason: "MISSING_PRODUCT" | "PRICE_DIFFERENT", requestId: string) =>
  apiClient<{ id: string }>(`${base}/${plan.id}/shopping-list/issues`, true, { version: plan.version, key, reason, requestId });
