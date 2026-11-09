import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import PlannerDisclosure from "../src/components/PlannerDisclosure";

test("nested lists toggle independently and preserve unfinished form input", () => {
  const onOpen = vi.fn();
  render(<PlannerDisclosure title="Prices" onOpen={onOpen}>
    <input aria-label="Price draft" defaultValue="" />
    <PlannerDisclosure title="Conditions"><p>Offer conditions</p></PlannerDisclosure>
  </PlannerDisclosure>);
  const prices = screen.getByRole("button", { name: "Prices" });
  expect(prices).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("textbox", { name: "Price draft" })).not.toBeInTheDocument();
  fireEvent.click(prices);
  fireEvent.change(screen.getByRole("textbox", { name: "Price draft" }), { target: { value: "4.25" } });
  fireEvent.click(screen.getByRole("button", { name: "Conditions" }));
  expect(prices).toHaveAttribute("aria-expanded", "true");
  expect(onOpen).toHaveBeenCalledOnce();
  fireEvent.click(prices);
  fireEvent.click(prices);
  expect(screen.getByRole("textbox", { name: "Price draft" })).toHaveValue("4.25");
  expect(screen.getByRole("button", { name: "Conditions" })).toHaveAttribute("aria-expanded", "true");
});
