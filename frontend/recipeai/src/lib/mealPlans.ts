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
  budget: number;
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
const base = "v2/meal-plans";
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
  apiClient<MealPlan>(`${base}/${plan.id}/shopping-list/refresh`, true, { version: plan.version });
export const checkPlanShopping = (plan: MealPlan, key: string, checked: boolean) =>
  apiClient<MealPlan>(`${base}/${plan.id}/shopping-list/check`, true, { version: plan.version, key, checked });

export const isSlotGenerating = (slot: PlanSlot) => slot.generationStatus === "RUNNING"
  && slot.generationStartedAt !== null && Date.now() - Date.parse(slot.generationStartedAt) < 300_000;

export const localDateInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
