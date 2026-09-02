import type { FridgeOperationReviewChange } from "../components/FridgeOperationReview";
import type { ShoppingListItem } from "./shoppingList";

const normalizeUnit = (
  unit: string | null | undefined,
): FridgeOperationReviewChange["unit"] => {
  const normalized = unit?.trim().toLowerCase();
  if (
    normalized === "g" ||
    normalized === "kg" ||
    normalized === "ml" ||
    normalized === "l" ||
    normalized === "pcs"
  ) {
    return normalized;
  }
  return "";
};

export const toShoppingToFridgeChange = (
  item: ShoppingListItem,
): FridgeOperationReviewChange => {
  const amount =
    item.amount === null || item.amount === undefined ? "" : String(item.amount);
  return {
    key: item.id,
    clientChangeId: item.id,
    originalAmount: amount,
    name: item.name,
    amount,
    unit: normalizeUnit(item.unit),
    quantityAccuracy: amount ? "ESTIMATED" : "UNKNOWN",
    selected: true,
    warning: amount ? "" : "Amount is unknown",
  };
};
