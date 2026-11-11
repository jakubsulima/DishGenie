import { apiClient } from "./hooks";
import type { MealPlan, PlanStore } from "./mealPlans";

export interface StoreOfferDetails {
  category?: string; ingredientId?: number; couponRequired?: boolean; bundlePrice?: number | null; bundleSize?: number | null; weighted?: boolean;
  store: PlanStore; productName: string; packageAmount: number; unit: string; packagePrice: number | null; maximumAmount?: number | null;
  minimumPackages: number; packageMultiple: number; maximumPackages: number | null; loyaltyRequired: boolean;
  validFrom: string; validTo: string; sourceUrl: string; conditions: string; verifiedAt: string;
}
export interface ManualPlanPrice {
  id: string; key: string; store: PlanStore; shoppingDate: string; packageAmount: number; unit: string;
  packagePrice: number; confirmedAt: string;
}
export interface PricedItem {
  key: string; name: string; offer: CatalogOffer | null;
  requiredAmount?: number | null; unit?: string | null; manualPrice?: ManualPlanPrice | null;
  packages: number | null; purchasedAmount: number | null; leftoverAmount: number | null; cost: number | null;
  missingReason: "NO_ELIGIBLE_OFFER" | "CHECK_QUANTITY" | null;
}
export interface PricedBasket {
  option: "LIDL" | "BIEDRONKA" | "COMBINED"; stores: PlanStore[]; items: PricedItem[];
  knownTotal: number; pricedItems: number; missingItems: number;
  budgetStatus: "WITHIN_BUDGET" | "OVER_BUDGET" | "INCOMPLETE" | "NO_BUDGET";
}
export interface PlanQuote {
  planId: string; planVersion: number; shoppingDate: string; calculatedAt: string; expiresAt: string;
  budget: number | null; baskets: PricedBasket[];
  sources?: { store: PlanStore; status: string; offers: number; fetchedAt: string | null }[];
}
export const quoteMealPlan = (plan: MealPlan, shoppingDate: string, loyaltyStores: PlanStore[]) =>
  apiClient<PlanQuote>(`v${plan.plan.schemaVersion >= 4 ? 4 : 3}/meal-plans/${plan.id}/quote-preview`, true,
    { version: plan.version, shoppingDate, loyaltyStores, confirmedCouponOffers: plan.plan.settings.shopping?.confirmedCouponOffers ?? [] }, { timeoutMs: 60_000 });
export const refreshStorePrices = () => apiClient("v2/offers/reload-prices", true, {}, { timeoutMs: 120_000 });
export const savePlanPrice = (plan: MealPlan, input: { key: string; store: PlanStore; shoppingDate: string; packageAmount: number; packagePrice: number }) =>
  apiClient<MealPlan>(`v${plan.plan.schemaVersion >= 4 ? 4 : 3}/meal-plans/${plan.id}/prices`, true, { version: plan.version, ...input });
export const removePlanPrice = (plan: MealPlan, id: string) =>
  apiClient<MealPlan>(`v${plan.plan.schemaVersion >= 4 ? 4 : 3}/meal-plans/${plan.id}/prices/${id}/remove`, true, { version: plan.version });

export interface CatalogOffer { id: string; version: number; details: StoreOfferDetails; sourceType?: string; ingredientKey?: string | null }
export interface LeafletImportSummary {
  title: string; sourceUrl: string; pdfSha256: string; startDate?: string; pages: number; candidates: number;
  reviewedCandidates: number; products: number; priceVariants: number; excludedReasons: Record<string, number>;
  importSeconds: number; paidApiCostUsd: string; cacheHit: boolean;
}
export const getOffers = (stores: PlanStore[], shoppingDate: string) =>
  apiClient<{ offers: CatalogOffer[]; sourceStatus: string; importSummary?: LeafletImportSummary | null }>(`v2/offers?stores=${stores.join(",")}&shoppingDate=${shoppingDate}`, false, null, { timeoutMs: 120_000 });
