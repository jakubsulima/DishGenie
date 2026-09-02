import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Fridge } from "../src/pages/Fridge";
import {
  type FridgeContextType,
  type FridgeIngredient,
  useFridge,
} from "../src/context/fridgeContext";
import { type AuthContextType, useUser } from "../src/context/context";
import { lookupProductByBarcode } from "../src/lib/hooks";

vi.mock("../src/context/fridgeContext", () => ({
  useFridge: vi.fn(),
  UNIT_OPTIONS: ["", "g", "kg", "ml", "l", "pcs"],
}));

vi.mock("../src/context/context", () => ({
  useUser: vi.fn(),
}));

vi.mock("../src/lib/hooks", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/hooks")>("../src/lib/hooks");
  return {
    ...actual,
    lookupProductByBarcode: vi.fn(),
  };
});

vi.mock("../src/lib/fridgeOperations", () => ({
  applyFridgeOperation: vi.fn(),
  createFridgeOperationId: () => "barcode-operation-1",
  undoFridgeOperation: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const createFridgeContextValue = (
  fridgeItems: FridgeIngredient[],
): FridgeContextType => ({
  fridgeItems,
  setFridgeItems: vi.fn(),
  loading: false,
  error: "",
  addFridgeItem: vi.fn(),
  addFridgeItemsBatch: vi.fn(),
  removeFridgeItem: vi.fn(),
  updateFridgeItem: vi.fn(),
  refreshFridgeItems: vi.fn(),
  getFridgeItemNames: vi.fn(() => fridgeItems.map((item) => item.name)),
});

describe("Fridge expired banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUser).mockReturnValue({
      user: { id: 1, email: "test@example.com", role: "USER" },
      setUser: vi.fn(),
      loading: false,
      isAdmin: false,
      getUserPreferences: vi.fn(),
      refreshSession: vi.fn(),
      logout: vi.fn(),
    } as AuthContextType);
  });

  test("is dismissible and stays hidden for the same expired set", () => {
    vi.mocked(useFridge).mockReturnValue(
      createFridgeContextValue([
        {
          id: 1,
          name: "Milk",
          expirationDate: "01-01-2020",
          amount: 1,
          unit: "pcs",
        },
      ]),
    );

    const { unmount } = render(
      <MemoryRouter>
        <Fridge />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Expired ingredients detected"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(
      localStorage.getItem("recipeai.expiredBannerDismissed:1"),
    ).toContain("1:Milk:01-01-2020");
    expect(
      screen.queryByText("Expired ingredients detected"),
    ).not.toBeInTheDocument();

    unmount();

    render(
      <MemoryRouter>
        <Fridge />
      </MemoryRouter>,
    );

    expect(
      screen.queryByText("Expired ingredients detected"),
    ).not.toBeInTheDocument();
  });

  test("reappears when the expired fingerprint changes", () => {
    vi.mocked(useFridge).mockReturnValue(
      createFridgeContextValue([
        {
          id: 2,
          name: "Yogurt",
          expirationDate: "02-01-2020",
          amount: 1,
          unit: "pcs",
        },
      ]),
    );

    render(
      <MemoryRouter>
        <Fridge />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Expired ingredients detected"),
    ).toBeInTheDocument();
  });

  test("reviews a barcode lookup before adding it through the operation API", async () => {
    const refreshFridgeItems = vi.fn();
    const addFridgeItem = vi.fn();
    vi.mocked(useFridge).mockReturnValue({
      ...createFridgeContextValue([]),
      addFridgeItem,
      refreshFridgeItems,
    });
    vi.mocked(lookupProductByBarcode).mockResolvedValue({
      barcode: "5901234123457",
      name: "Oat Drink",
      brand: "Kitchen Brand",
    });

    const { applyFridgeOperation } = await import("../src/lib/fridgeOperations");
    vi.mocked(applyFridgeOperation).mockResolvedValue({
      operationId: "barcode-operation-1",
      status: "APPLIED",
      appliedChanges: [],
      skippedChanges: [],
      currentItems: [],
    });

    render(
      <MemoryRouter>
        <Fridge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Scan Barcode/ }));
    fireEvent.change(screen.getByPlaceholderText("e.g. 5901234123457"), {
      target: { value: "5901234123457" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use Code" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish scanning" }));

    expect(await screen.findByRole("heading", { name: "Review barcode session" })).toBeInTheDocument();
    expect(addFridgeItem).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add product to fridge" }));

    await waitFor(() => expect(applyFridgeOperation).toHaveBeenCalledTimes(1));
    expect(applyFridgeOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: "barcode-operation-1",
        source: "BARCODE_SCAN",
        changes: [
          expect.objectContaining({
            clientChangeId: "5901234123457",
            barcode: "5901234123457",
            name: "Oat Drink",
            quantityAccuracy: "EXACT",
          }),
        ],
      }),
    );
    expect(refreshFridgeItems).toHaveBeenCalled();
  });

  test("keeps the scanner session open and merges repeated barcode scans", async () => {
    vi.mocked(useFridge).mockReturnValue({
      ...createFridgeContextValue([]),
      refreshFridgeItems: vi.fn(),
    });
    vi.mocked(lookupProductByBarcode).mockResolvedValue({
      barcode: "5901234123457",
      name: "Oat Drink",
      brand: null,
    });

    const { applyFridgeOperation } = await import("../src/lib/fridgeOperations");
    vi.mocked(applyFridgeOperation).mockResolvedValue({
      operationId: "barcode-operation-1",
      status: "APPLIED",
      appliedChanges: [],
      skippedChanges: [],
      currentItems: [],
    });

    render(
      <MemoryRouter>
        <Fridge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Scan Barcode/ }));
    const barcodeInput = screen.getByPlaceholderText("e.g. 5901234123457");
    fireEvent.change(barcodeInput, { target: { value: "5901234123457" } });
    fireEvent.click(screen.getByRole("button", { name: "Use Code" }));
    await waitFor(() => expect(screen.getByText("1 scanned")).toBeInTheDocument());

    fireEvent.change(barcodeInput, { target: { value: "5901234123457" } });
    fireEvent.click(screen.getByRole("button", { name: "Use Code" }));
    await waitFor(() => expect(screen.getByText("2 scanned")).toBeInTheDocument());

    expect(screen.queryByRole("heading", { name: "Review barcode session" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finish scanning" }));

    expect(await screen.findByRole("heading", { name: "Review barcode session" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toHaveValue(2);
  });

  test("continues the queue when an unknown barcode is between valid products", async () => {
    vi.mocked(useFridge).mockReturnValue({
      ...createFridgeContextValue([]),
      refreshFridgeItems: vi.fn(),
    });
    vi.mocked(lookupProductByBarcode).mockImplementation(async (barcode) => {
      if (barcode === "4000000000000") {
        return null;
      }
      return {
        barcode,
        name: barcode === "5901234123457" ? "Oat Drink" : "Granola",
        brand: null,
      };
    });

    render(
      <MemoryRouter>
        <Fridge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Scan Barcode/ }));
    const barcodeInput = screen.getByPlaceholderText("e.g. 5901234123457");
    for (const barcode of ["5901234123457", "4000000000000", "4000000000001"]) {
      fireEvent.change(barcodeInput, { target: { value: barcode } });
      fireEvent.click(screen.getByRole("button", { name: "Use Code" }));
    }

    await waitFor(() => expect(screen.getByText("3 scanned")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Finish scanning" }));

    expect(await screen.findByDisplayValue("Oat Drink")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Granola")).toBeInTheDocument();
    expect(screen.getByText("Product not found. Enter a name before adding.")).toBeInTheDocument();
  });

  test("continues the queue after a network lookup failure", async () => {
    vi.mocked(useFridge).mockReturnValue({
      ...createFridgeContextValue([]),
      refreshFridgeItems: vi.fn(),
    });
    vi.mocked(lookupProductByBarcode).mockImplementation(async (barcode) => {
      if (barcode === "4000000000000") {
        throw new Error("No response from server");
      }
      return { barcode, name: "Valid Product", brand: null };
    });

    render(
      <MemoryRouter>
        <Fridge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Scan Barcode/ }));
    const barcodeInput = screen.getByPlaceholderText("e.g. 5901234123457");
    for (const barcode of ["5901234123457", "4000000000000", "4000000000001"]) {
      fireEvent.change(barcodeInput, { target: { value: barcode } });
      fireEvent.click(screen.getByRole("button", { name: "Use Code" }));
    }

    await waitFor(() => expect(screen.getByText("3 scanned")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Finish scanning" }));

    await waitFor(() => expect(screen.getAllByDisplayValue("Valid Product")).toHaveLength(2));
    expect(screen.getByText("No response from server")).toBeInTheDocument();
  });

  test("edits one product and submits all selected products in one operation", async () => {
    vi.mocked(useFridge).mockReturnValue({
      ...createFridgeContextValue([]),
      refreshFridgeItems: vi.fn(),
    });
    vi.mocked(lookupProductByBarcode).mockImplementation(async (barcode) => ({
      barcode,
      name: barcode === "5901234123457" ? "Oat Drink" : "Granola",
      brand: null,
    }));

    const { applyFridgeOperation } = await import("../src/lib/fridgeOperations");
    vi.mocked(applyFridgeOperation).mockResolvedValue({
      operationId: "barcode-operation-1",
      status: "APPLIED",
      appliedChanges: [],
      skippedChanges: [],
      currentItems: [],
    });

    render(
      <MemoryRouter>
        <Fridge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Scan Barcode/ }));
    const barcodeInput = screen.getByPlaceholderText("e.g. 5901234123457");
    for (const barcode of ["5901234123457", "4000000000001"]) {
      fireEvent.change(barcodeInput, { target: { value: barcode } });
      fireEvent.click(screen.getByRole("button", { name: "Use Code" }));
    }
    await waitFor(() => expect(screen.getByText("2 scanned")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Finish scanning" }));
    await screen.findByRole("heading", { name: "Review barcode session" });

    fireEvent.change(screen.getAllByRole("textbox", { name: "Item name" })[0], {
      target: { value: "Edited Oat Drink" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Include Granola" }));
    fireEvent.click(screen.getByRole("button", { name: "Add product to fridge" }));

    await waitFor(() => expect(applyFridgeOperation).toHaveBeenCalledTimes(1));
    expect(applyFridgeOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [
          expect.objectContaining({
            name: "Edited Oat Drink",
            clientChangeId: "5901234123457",
          }),
        ],
      }),
    );
  });

  test("keeps invalid items visible while submitting the other valid products", async () => {
    vi.mocked(useFridge).mockReturnValue({
      ...createFridgeContextValue([]),
      refreshFridgeItems: vi.fn(),
    });
    vi.mocked(lookupProductByBarcode).mockImplementation(async (barcode) =>
      barcode === "4000000000000"
        ? null
        : { barcode, name: "Valid Product", brand: null },
    );

    const { applyFridgeOperation } = await import("../src/lib/fridgeOperations");
    vi.mocked(applyFridgeOperation).mockResolvedValue({
      operationId: "barcode-operation-1",
      status: "APPLIED",
      appliedChanges: [],
      skippedChanges: [],
      currentItems: [],
    });

    render(
      <MemoryRouter>
        <Fridge />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Scan Barcode/ }));
    const barcodeInput = screen.getByPlaceholderText("e.g. 5901234123457");
    for (const barcode of ["5901234123457", "4000000000000"]) {
      fireEvent.change(barcodeInput, { target: { value: barcode } });
      fireEvent.click(screen.getByRole("button", { name: "Use Code" }));
    }
    await waitFor(() => expect(screen.getByText("2 scanned")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Finish scanning" }));
    await screen.findByRole("heading", { name: "Review barcode session" });

    fireEvent.click(screen.getByRole("button", { name: "Add product to fridge" }));

    await waitFor(() => expect(applyFridgeOperation).toHaveBeenCalledTimes(1));
    expect(applyFridgeOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [expect.objectContaining({ name: "Valid Product" })],
      }),
    );
    expect(screen.getByText("Product name is required.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review barcode session" })).toBeInTheDocument();
  });

  test("runs a quick decrement and offers an idempotent undo action", async () => {
    const refreshFridgeItems = vi.fn();
    const setFridgeItems = vi.fn();
    vi.mocked(useFridge).mockReturnValue({
      ...createFridgeContextValue([
        {
          id: 8,
          name: "Eggs",
          expirationDate: null,
          amount: 2,
          unit: "pcs",
        },
      ]),
      refreshFridgeItems,
      setFridgeItems,
    });

    const { applyFridgeOperation, undoFridgeOperation } = await import("../src/lib/fridgeOperations");
    vi.mocked(applyFridgeOperation).mockResolvedValue({
      operationId: "quick-operation-1",
      status: "APPLIED",
      appliedChanges: [],
      skippedChanges: [],
      currentItems: [],
    });
    vi.mocked(undoFridgeOperation).mockResolvedValue({
      operationId: "undo-operation-1",
      status: "APPLIED",
      appliedChanges: [],
      skippedChanges: [],
      currentItems: [],
    });

    render(
      <MemoryRouter>
        <Fridge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use 1 Eggs" }));
    await waitFor(() => expect(applyFridgeOperation).toHaveBeenCalledTimes(1));
    expect(applyFridgeOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "QUICK_ADJUSTMENT",
        changes: [
          expect.objectContaining({
            type: "DECREMENT",
            fridgeItemId: 8,
            amount: 1,
          }),
        ],
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(undoFridgeOperation).toHaveBeenCalledTimes(1));
    expect(refreshFridgeItems).toHaveBeenCalledTimes(2);
  });
});
