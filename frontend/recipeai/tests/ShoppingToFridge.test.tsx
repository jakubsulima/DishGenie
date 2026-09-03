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

const { applyFridgeOperation, fetchShoppingList, readShoppingList, refreshFridgeItems, syncShoppingList, writeShoppingList } =
  vi.hoisted(() => ({
    applyFridgeOperation: vi.fn(),
    fetchShoppingList: vi.fn(),
    readShoppingList: vi.fn(),
    refreshFridgeItems: vi.fn(),
    syncShoppingList: vi.fn(),
    writeShoppingList: vi.fn(),
  }));

vi.mock("../src/context/fridgeContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/context/fridgeContext")>();
  return {
    ...actual,
    useFridge: () => ({ refreshFridgeItems }),
  };
});

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
    refreshFridgeItems.mockResolvedValue(undefined);
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
    await waitFor(() => expect(fetchShoppingList).toHaveBeenCalledTimes(1));
    expect(
      screen.getByText(
        "Check off products as you shop, then use Finish shopping to add them to your fridge.",
      ),
    ).toBeInTheDocument();
    expect(applyFridgeOperation).not.toHaveBeenCalled();

    fireEvent.click(finishButton);
    expect(await screen.findByRole("heading", { name: "What to add to the fridge?" })).toBeInTheDocument();
    expect(applyFridgeOperation).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Item name" })).not.toBeInTheDocument();

    const editButton = screen.getByRole("button", { name: "Edit Milk" });
    expect(editButton).toHaveTextContent("Edit");
    fireEvent.click(editButton);
    expect(screen.getByRole("textbox", { name: "Item name" })).toHaveValue("Milk");
    expect(screen.queryByRole("combobox", { name: "Quantity accuracy" })).not.toBeInTheDocument();
    fireEvent.click(editButton);
    expect(screen.queryByRole("textbox", { name: "Item name" })).not.toBeInTheDocument();

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
    expect(refreshFridgeItems).toHaveBeenCalledTimes(1);
  });

  test("removes imported items while keeping unchecked items on the list", async () => {
    render(
      <LanguageProvider initialLocale="en">
        <ShoppingList />
      </LanguageProvider>,
    );

    const finishButton = await screen.findByRole("button", { name: "Finish shopping" });
    await waitFor(() => expect(fetchShoppingList).toHaveBeenCalledTimes(1));
    fireEvent.click(finishButton);
    fireEvent.click(await screen.findByRole("button", { name: "Add selected to fridge" }));

    await waitFor(() => expect(screen.queryByText("Milk - 2 pcs")).not.toBeInTheDocument());
    expect(screen.getByText("Bread")).toBeInTheDocument();
  });
});
