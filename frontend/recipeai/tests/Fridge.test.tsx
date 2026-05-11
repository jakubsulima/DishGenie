import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Fridge } from "../src/pages/Fridge";
import { useFridge } from "../src/context/fridgeContext";
import { useUser } from "../src/context/context";

vi.mock("../src/context/fridgeContext", () => ({
  useFridge: vi.fn(),
}));

vi.mock("../src/context/context", () => ({
  useUser: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const createFridgeContextValue = (fridgeItems: unknown[]) => ({
  fridgeItems,
  loading: false,
  error: "",
  addFridgeItem: vi.fn(),
  addFridgeItemsBatch: vi.fn(),
  removeFridgeItem: vi.fn(),
  updateFridgeItem: vi.fn(),
});

describe("Fridge expired banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUser).mockReturnValue({
      user: { id: 1, role: "USER" },
    } as ReturnType<typeof useUser>);
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
      ]) as ReturnType<typeof useFridge>,
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
      ]) as ReturnType<typeof useFridge>,
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
});
