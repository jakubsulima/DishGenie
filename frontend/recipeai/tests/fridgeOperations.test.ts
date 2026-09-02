import { describe, expect, test, vi } from "vitest";

const { apiClientMock } = vi.hoisted(() => ({ apiClientMock: vi.fn() }));

vi.mock("../src/lib/hooks", () => ({
  apiClient: apiClientMock,
}));

import {
  applyFridgeOperation,
  createFridgeOperationId,
  type FridgeInventoryOperationRequest,
} from "../src/lib/fridgeOperations";

describe("fridge operations client", () => {
  test("reuses the caller-created operation id during retry", async () => {
    apiClientMock.mockResolvedValue({ operationId: "operation-1" });
    const request: FridgeInventoryOperationRequest = {
      operationId: "operation-1",
      source: "QUICK_ADJUSTMENT",
      changes: [{ type: "FINISH", fridgeItemId: 12 }],
    };

    await applyFridgeOperation(request);
    await applyFridgeOperation(request);

    expect(apiClientMock).toHaveBeenNthCalledWith(
      1,
      "v2/fridge/operations",
      true,
      request,
    );
    expect(apiClientMock).toHaveBeenNthCalledWith(
      2,
      "v2/fridge/operations",
      true,
      request,
    );
  });

  test("creates a UUID before a request is sent", () => {
    expect(createFridgeOperationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
