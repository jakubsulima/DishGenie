import { apiClient } from "./hooks";
import type { FridgeIngredient } from "../context/fridgeContext";

type FridgeOperationSource =
  | "SHOPPING_LIST"
  | "BARCODE_SCAN"
  | "QUICK_ADJUSTMENT"
  | "COOKED_RECIPE";

type FridgeOperationChangeType = "ADD" | "DECREMENT" | "FINISH" | "MARK_LOW";
type QuantityAccuracy = "EXACT" | "ESTIMATED" | "UNKNOWN";
type FridgeStockState = "IN_STOCK" | "LOW";

export interface FridgeInventoryChangeRequest {
  type: FridgeOperationChangeType;
  clientChangeId?: string;
  fridgeItemId?: number;
  name?: string;
  amount?: number;
  unit?: string;
  expirationDate?: string | null;
  barcode?: string | null;
  quantityAccuracy?: QuantityAccuracy;
  stockState?: FridgeStockState;
}

export interface FridgeInventoryOperationRequest {
  operationId: string;
  source: FridgeOperationSource;
  sourceReference?: string;
  changes: FridgeInventoryChangeRequest[];
}

interface FridgeInventoryChangeResult {
  type: FridgeOperationChangeType;
  fridgeItemId?: number;
  status: "APPLIED" | "SKIPPED";
  reason?: string;
  clientChangeId?: string;
}

interface FridgeInventoryOperationResponse {
  operationId: string;
  status: "APPLIED" | "PARTIAL";
  appliedChanges: FridgeInventoryChangeResult[];
  skippedChanges: FridgeInventoryChangeResult[];
  currentItems: FridgeIngredient[];
}

export const createFridgeOperationId = (): string => crypto.randomUUID();

export const applyFridgeOperation = (
  request: FridgeInventoryOperationRequest,
): Promise<FridgeInventoryOperationResponse> =>
  apiClient<FridgeInventoryOperationResponse>("v2/fridge/operations", true, request);

export const undoFridgeOperation = (
  operationId: string,
  undoOperationId: string,
): Promise<FridgeInventoryOperationResponse> =>
  apiClient<FridgeInventoryOperationResponse>(
    `v2/fridge/operations/${encodeURIComponent(operationId)}/undo`,
    true,
    { operationId: undoOperationId },
  );
