import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import FridgeIngredientContainer from "../src/components/FridgeIngredientContainer";

describe("FridgeIngredientContainer", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Unit l" }));
    fireEvent.click(screen.getByRole("button", { name: "ml" }));
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
      "grid-cols-[minmax(0,0.95fr)_4.25rem_minmax(0,1.2fr)]",
    );
    expect(screen.getByRole("button", { name: "Unit l" })).toBeInTheDocument();
    expect(screen.getByLabelText("Expiration")).toBeInTheDocument();
  });
});
