import { apiClient } from "./hooks";
import type { MealPlan, PlanStore } from "./mealPlans";

interface StoreOfferDetails {
  store: PlanStore; productName: string; packageAmount: number; unit: string; packagePrice: number;
  minimumPackages: number; packageMultiple: number; maximumPackages: number | null; loyaltyRequired: boolean;
  validFrom: string; validTo: string; sourceUrl: string; conditions: string; verifiedAt: string;
}
interface PricedItem {
  key: string; name: string; offer: { id: string; version: number; details: StoreOfferDetails } | null;
  packages: number | null; purchasedAmount: number | null; leftoverAmount: number | null; cost: number | null;
  missingReason: "NO_ELIGIBLE_OFFER" | "CHECK_QUANTITY" | null;
}
export interface PricedBasket {
  option: "LIDL" | "BIEDRONKA" | "COMBINED"; stores: PlanStore[]; items: PricedItem[];
  knownTotal: number; pricedItems: number; missingItems: number;
  budgetStatus: "WITHIN_BUDGET" | "OVER_BUDGET" | "INCOMPLETE";
}
export interface PlanQuote {
  planId: string; planVersion: number; shoppingDate: string; calculatedAt: string; expiresAt: string;
  budget: number; baskets: PricedBasket[];
}
export const quoteMealPlan = (plan: MealPlan, shoppingDate: string, loyaltyStores: PlanStore[]) =>
  apiClient<PlanQuote>(`v2/meal-plans/${plan.id}/quote`, true, { version: plan.version, shoppingDate, loyaltyStores });
