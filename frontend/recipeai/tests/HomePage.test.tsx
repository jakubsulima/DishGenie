import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import HomePage from "../src/pages/HomePage";
import { useUser } from "../src/context/context";
import { useFridge } from "../src/context/fridgeContext";
import { captureEvent } from "../src/lib/posthog";
import { apiClient } from "../src/lib/hooks";

vi.mock("../src/context/context", () => ({
  useUser: vi.fn(),
}));

vi.mock("../src/context/fridgeContext", () => ({
  useFridge: vi.fn(),
}));

vi.mock("../src/lib/posthog", () => ({
  captureEvent: vi.fn(),
}));

vi.mock("../src/lib/hooks", () => ({
  apiClient: vi.fn(),
}));

const RecipeRouteProbe = () => {
  const location = useLocation();
  const search =
    (
      location.state as {
        search?: string;
      } | null
    )?.search ?? "";

  return <div>Recipe Prompt::{search}</div>;
};

const renderHomePage = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/Recipe" element={<RecipeRouteProbe />} />
      </Routes>
    </MemoryRouter>,
  );

const mockFridge = (overrides: Partial<ReturnType<typeof useFridge>> = {}) => {
  const fridgeItems = overrides.fridgeItems ?? [];

  vi.mocked(useFridge).mockReturnValue({
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
    ...overrides,
  } as ReturnType<typeof useFridge>);
};

describe("HomePage chooser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(apiClient).mockResolvedValue({
      content: [],
      totalPages: 1,
    });

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });

    vi.mocked(useUser).mockReturnValue({
      user: { id: 1, email: "cook@example.com", role: "USER" },
    } as ReturnType<typeof useUser>);

    mockFridge();
  });

  test("turns presets, sliders, chips, and meal choice into a recipe prompt", () => {
    mockFridge({
      fridgeItems: [
        {
          id: 1,
          name: "pickles",
          expirationDate: null,
          amount: 1,
          unit: "pcs",
        },
      ],
    });
    renderHomePage();

    fireEvent.change(
      screen.getByPlaceholderText("eggs, rice, spinach, chicken"),
      {
        target: { value: "eggs" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Tired weeknight" }));
    expect(
      screen.getByText("Tired weeknight: quick, low effort, use mine, low cleanup"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tired weeknight: quick, low effort, low cleanup"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Tune details"));
    expect(
      screen.getByRole("button", { name: "Hide details" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Selected: Quick")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Quick" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dinner" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.change(screen.getByLabelText("Flavor intensity"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "High protein" }));
    fireEvent.click(screen.getByRole("button", { name: "Dinner" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Show me 3 ideas" }).at(-1)!,
    );

    const prompt = screen.getByText(/^Recipe Prompt::/).textContent ?? "";

    expect(prompt).toContain("quick");
    expect(prompt).toContain("low effort");
    expect(prompt).toContain("use only ingredients I already have");
    expect(prompt).toContain("spicy bold flavor");
    expect(prompt).toContain("low cleanup");
    expect(prompt).toContain("high protein");
    expect(prompt).toContain("dinner recipe with eggs");
    expect(prompt).not.toContain("pickles");
    expect(prompt).not.toContain("try to use those ingredients");
    expect(captureEvent).toHaveBeenCalledWith(
      "marketing_cta_click",
      expect.objectContaining({
        selectedCategoryCount: 7,
        selectedConstraints: ["Low cleanup", "High protein"],
        selectedPreset: null,
      }),
    );
  });

  test("shows workflow dashboard for logged-in users instead of landing tutorial", async () => {
    mockFridge({
      fridgeItems: [
        {
          id: 1,
          name: "tomatoes",
          expirationDate: null,
          amount: 2,
          unit: "pcs",
        },
      ],
    });

    renderHomePage();

    expect(
      screen.getByRole("heading", { name: "What should we cook next?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Quick setup")).toBeInTheDocument();
    expect(screen.getByText("Saved fridge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tomatoes" })).toBeInTheDocument();
    expect(screen.getByText("Recent dinners")).toBeInTheDocument();
    await waitFor(() => expect(apiClient).toHaveBeenCalled());
    expect(apiClient).toHaveBeenCalledWith(
      expect.stringContaining("locale=en"),
      false,
    );
    expect(
      screen.queryByText("Get 3 realistic options"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("How Dish Genie helps after you choose"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /How it works/i }));

    expect(screen.getByText("Get 3 realistic options")).toBeInTheDocument();
    expect(screen.getByText("Scan groceries fast")).toBeInTheDocument();
  });

  test("shows full landing tutorial for anonymous users", () => {
    vi.mocked(useUser).mockReturnValue({
      user: null,
      loading: false,
    } as ReturnType<typeof useUser>);

    renderHomePage();

    expect(
      screen.getByRole("heading", {
        name: "What can I cook with these ingredients?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Browse latest public recipes")).toBeInTheDocument();
    expect(
      screen.getByText("How Dish Genie helps after you choose"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Saved fridge")).not.toBeInTheDocument();
  });
});
