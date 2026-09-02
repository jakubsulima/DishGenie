import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { LanguageProvider } from "../src/context/languageContext";
import FridgeOperationReview, {
  type FridgeOperationReviewChange,
} from "../src/components/FridgeOperationReview";
import { toShoppingToFridgeChange } from "../src/lib/shoppingToFridge";

describe("FridgeOperationReview", () => {
  test("shows editable mobile-friendly change rows and reports selection", () => {
    const onChange = vi.fn();
    const changes: FridgeOperationReviewChange[] = [
      {
        key: "milk",
        name: "Milk",
        amount: "",
        unit: "",
        quantityAccuracy: "UNKNOWN",
        selected: true,
        warning: "Amount is unknown",
      },
    ];

    render(
      <LanguageProvider initialLocale="en">
        <FridgeOperationReview
          changes={changes}
          onChange={onChange}
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole("textbox", { name: "Item name" })).toHaveValue("Milk");
    expect(screen.getByText("Amount is unknown")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Include Milk" }));

    expect(onChange).toHaveBeenCalledWith({
      key: "milk",
      name: "Milk",
      amount: "",
      unit: "",
      quantityAccuracy: "UNKNOWN",
      selected: false,
      warning: "Amount is unknown",
    });
  });

  test("marks shopping quantities as estimated and preserves the client id", () => {
    expect(
      toShoppingToFridgeChange({
        id: "shopping-1",
        name: "Rice",
        amount: 180,
        unit: "g",
        checked: true,
        createdAt: "2026-09-02T08:00:00.000Z",
      }),
    ).toMatchObject({
      key: "shopping-1",
      clientChangeId: "shopping-1",
      amount: "180",
      unit: "g",
      quantityAccuracy: "ESTIMATED",
      selected: true,
    });
  });
});
