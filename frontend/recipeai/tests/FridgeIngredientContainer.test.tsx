import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import FridgeIngredientContainer from "../src/components/FridgeIngredientContainer";

describe("FridgeIngredientContainer", () => {
  test("exposes quick actions for a known piece count", () => {
    const onQuickAction = vi.fn();

    render(
      <FridgeIngredientContainer
        id={7}
        name="Eggs"
        expirationDate={null}
        amount={2}
        unit="pcs"
        onQuickAction={onQuickAction}
        remove={vi.fn()}
        onUpdateItem={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use 1 Eggs" }));
    expect(onQuickAction).toHaveBeenNthCalledWith(1, "DECREMENT");
    expect(screen.getByRole("button", { name: "Mark as low" })).toHaveTextContent(
      "Plenty",
    );
    expect(
      screen.queryByRole("button", { name: "Finish Eggs" }),
    ).not.toBeInTheDocument();
  });

  test("shows a compact low stock pill and lets the user mark it as enough", () => {
    const onQuickAction = vi.fn();

    render(
      <FridgeIngredientContainer
        id={7}
        name="Eggs"
        expirationDate={null}
        amount=""
        unit=""
        stockState="LOW"
        onQuickAction={onQuickAction}
        remove={vi.fn()}
        onUpdateItem={vi.fn()}
      />,
    );

    const stockButton = screen.getByRole("button", { name: "Mark as enough" });
    expect(stockButton).toHaveTextContent("Low");
    fireEvent.click(stockButton);
    expect(onQuickAction).toHaveBeenCalledWith("MARK_LOW");
  });

  test("edits all displayed fridge item fields inline", async () => {
    const updateItem = vi.fn().mockResolvedValue(undefined);

    render(
      <FridgeIngredientContainer
        id={7}
        name="Milk"
        expirationDate="20-05-2026"
        amount={1}
        unit="l"
        remove={vi.fn()}
        onUpdateItem={updateItem}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit milk/i }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Oat milk" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "750" },
    });
    fireEvent.change(screen.getByLabelText("Unit l"), {
      target: { value: "ml" },
    });
    fireEvent.change(screen.getByLabelText("Expiration"), {
      target: { value: "2026-05-21" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith(7, {
        name: "Oat milk",
        expirationDate: "21-05-2026",
        amount: "750",
        unit: "ml",
      }),
    );
  });

  test("shows inline validation for invalid edits", () => {
    const updateItem = vi.fn();

    render(
      <FridgeIngredientContainer
        id={7}
        name="Milk"
        expirationDate={null}
        amount={1}
        unit="l"
        remove={vi.fn()}
        onUpdateItem={updateItem}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit milk/i }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(updateItem).not.toHaveBeenCalled();
  });

  test("warns that saving a zero amount removes the item", () => {
    render(
      <FridgeIngredientContainer
        id={7}
        name="Milk"
        expirationDate={null}
        amount={1}
        unit="l"
        remove={vi.fn()}
        onUpdateItem={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit milk/i }));
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "0" },
    });

    expect(
      screen.getByText("Saving 0 will remove this item."),
    ).toBeInTheDocument();
  });

  test("keeps amount, unit, and expiration controls in one row", () => {
    render(
      <FridgeIngredientContainer
        id={7}
        name="Milk"
        expirationDate="20-05-2026"
        amount={1}
        unit="l"
        remove={vi.fn()}
        onUpdateItem={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit milk/i }));

    const amountInput = screen.getByLabelText("Amount");
    const fieldRow = amountInput.closest(".grid");

    expect(fieldRow).toHaveClass(
      "grid-cols-[4.5rem_4rem_minmax(0,1fr)]",
    );
    expect(screen.getByRole("combobox", { name: "Unit l" })).toBeInTheDocument();
    expect(screen.getByLabelText("Expiration")).toBeInTheDocument();
  });

  test("uses a mobile-safe font size for every edit control", () => {
    render(
      <FridgeIngredientContainer
        id={7}
        name="Milk"
        expirationDate="20-05-2026"
        amount={1}
        unit="l"
        remove={vi.fn()}
        onUpdateItem={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit milk/i }));

    [
      screen.getByLabelText("Name"),
      screen.getByLabelText("Amount"),
      screen.getByRole("combobox", { name: "Unit l" }),
      screen.getByLabelText("Expiration"),
    ].forEach((control) => expect(control).toHaveClass("text-base"));
  });

  test("shows separate edit action at the end of the card", () => {
    render(
      <FridgeIngredientContainer
        id={7}
        name="Milk"
        expirationDate="20-05-2026"
        amount={1}
        unit="l"
        remove={vi.fn()}
        onUpdateItem={vi.fn()}
      />,
    );

    expect(screen.getByText("1 l")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit milk/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove milk/i })).toBeInTheDocument();
  });

  test("omits empty optional details from the compact row", () => {
    render(
      <FridgeIngredientContainer
        id={7}
        name="Milk"
        expirationDate={null}
        amount=""
        unit=""
        remove={vi.fn()}
        onUpdateItem={vi.fn()}
      />,
    );

    expect(screen.getByRole("group", { name: "Milk" })).toBeInTheDocument();
    expect(screen.queryByText("No amount")).not.toBeInTheDocument();
  });

  test("removes an item from the visible trash action", () => {
    const remove = vi.fn();
    render(
      <FridgeIngredientContainer
        id={7}
        name="Milk"
        expirationDate={null}
        amount=""
        unit=""
        remove={remove}
        onUpdateItem={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /remove milk/i }));
    expect(remove).toHaveBeenCalledOnce();
  });
});
