import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { LanguageProvider } from "../src/context/languageContext";
import ShoppingList from "../src/pages/ShoppingList";

const shoppingItems = [
  {
    id: "milk",
    name: "Milk",
    amount: 2,
    unit: "pcs",
    checked: true,
    createdAt: "2026-09-02T08:00:00.000Z",
  },
  {
    id: "bread",
    name: "Bread",
    amount: null,
    unit: null,
    checked: false,
    createdAt: "2026-09-02T08:01:00.000Z",
  },
];

const { applyFridgeOperation, fetchShoppingList, readShoppingList, syncShoppingList, writeShoppingList } =
  vi.hoisted(() => ({
    applyFridgeOperation: vi.fn(),
    fetchShoppingList: vi.fn(),
    readShoppingList: vi.fn(),
    syncShoppingList: vi.fn(),
    writeShoppingList: vi.fn(),
  }));

vi.mock("../src/lib/fridgeOperations", () => ({
  applyFridgeOperation,
  createFridgeOperationId: () => "operation-1",
}));

vi.mock("../src/lib/shoppingList", () => ({
  createShoppingListItemId: () => "new-item",
  fetchShoppingList,
  getShoppingListFingerprint: (items: unknown) => JSON.stringify(items),
  readShoppingList,
  syncShoppingList,
  writeShoppingList,
}));

describe("ShoppingList fridge import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readShoppingList.mockReturnValue(shoppingItems);
    fetchShoppingList.mockResolvedValue(shoppingItems);
    syncShoppingList.mockImplementation(async (items) => items);
    applyFridgeOperation.mockResolvedValue({
      operationId: "operation-1",
      status: "APPLIED",
      appliedChanges: [
        {
          type: "ADD",
          clientChangeId: "milk",
          fridgeItemId: 42,
          status: "APPLIED",
        },
      ],
      skippedChanges: [],
      currentItems: [],
    });
  });

  test("waits for confirmation and sends estimated shopping quantities", async () => {
    render(
      <LanguageProvider initialLocale="en">
        <ShoppingList />
      </LanguageProvider>,
    );

    const finishButton = await screen.findByRole("button", { name: "Finish shopping" });
    expect(applyFridgeOperation).not.toHaveBeenCalled();

    fireEvent.click(finishButton);
    expect(await screen.findByRole("heading", { name: "What to add to the fridge?" })).toBeInTheDocument();
    expect(applyFridgeOperation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add selected to fridge" }));

    await waitFor(() => expect(applyFridgeOperation).toHaveBeenCalledTimes(1));
    expect(applyFridgeOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: "operation-1",
        source: "SHOPPING_LIST",
        changes: [
          expect.objectContaining({
            type: "ADD",
            clientChangeId: "milk",
            amount: 2,
            unit: "pcs",
            quantityAccuracy: "ESTIMATED",
          }),
        ],
      }),
    );
    expect(screen.queryByText("Milk - 2 pcs")).not.toBeInTheDocument();
    expect(screen.getByText("Bread")).toBeInTheDocument();
  });

  test("removes imported items while keeping unchecked items on the list", async () => {
    render(
      <LanguageProvider initialLocale="en">
        <ShoppingList />
      </LanguageProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Finish shopping" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add selected to fridge" }));

    await waitFor(() => expect(screen.queryByText("Milk - 2 pcs")).not.toBeInTheDocument());
    expect(screen.getByText("Bread")).toBeInTheDocument();
  });
});
