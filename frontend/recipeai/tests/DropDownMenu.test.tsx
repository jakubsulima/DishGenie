import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DropDownMenu from "../src/components/DropDownMenu";
import { renderWithRouter } from "./testUtils";

describe("DropDownMenu", () => {
  it("renders navigation links and a logout button", () => {
    const handleLogout = vi.fn();

    renderWithRouter(
      <DropDownMenu
        dropdownItems={["Home", "Recipes", "Logout"]}
        className="test-class"
        handleLogout={handleLogout}
      />,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Recipes" })).toHaveAttribute(
      "href",
      "/Recipes",
    );

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it("applies the provided className to the container", () => {
    const { container } = renderWithRouter(
      <DropDownMenu
        dropdownItems={["Login"]}
        className="test-class"
        handleLogout={vi.fn()}
      />,
    );

    expect(container.firstChild).toHaveClass("test-class");
  });

  it("renders an empty menu state without crashing", () => {
    renderWithRouter(
      <DropDownMenu
        dropdownItems={[]}
        className="test-class"
        handleLogout={vi.fn()}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
