import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RecipePage from "../src/pages/RecipePage";
import { apiClient, deleteClient, generateRecipe } from "../src/lib/hooks";
import { useFridge } from "../src/context/fridgeContext";
import { useUser } from "../src/context/context";

vi.mock("../src/lib/hooks", () => ({
  apiClient: vi.fn(),
  generateRecipe: vi.fn(),
  deleteClient: vi.fn(),
  cleanAiJsonString: (value: unknown) =>
    typeof value === "string" ? value : JSON.stringify(value),
}));

vi.mock("../src/context/fridgeContext", () => ({
  useFridge: vi.fn(),
}));

vi.mock("../src/context/context", () => ({
  useUser: vi.fn(),
}));

vi.mock("../src/lib/shoppingList", () => ({
  addShoppingItems: vi.fn(() => []),
}));

const renderRecipePage = (
  initialEntry: string | { pathname: string; state?: unknown },
) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/Recipe" element={<RecipePage />} />
        <Route path="/Recipe/:id" element={<RecipePage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("RecipePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useUser).mockReturnValue({
      user: { id: 1, email: "test@example.com", role: "USER" },
    } as ReturnType<typeof useUser>);

    vi.mocked(useFridge).mockReturnValue({
      fridgeItems: [],
      setFridgeItems: vi.fn(),
      loading: false,
      error: "",
      addFridgeItem: vi.fn(),
      addFridgeItemsBatch: vi.fn(),
      removeFridgeItem: vi.fn(),
      updateFridgeItem: vi.fn(),
      refreshFridgeItems: vi.fn(),
      getFridgeItemNames: vi.fn(() => ["egg", "milk"]),
    });

    vi.mocked(apiClient).mockResolvedValue({});
    vi.mocked(generateRecipe).mockResolvedValue({});
    vi.mocked(deleteClient).mockResolvedValue({});
  });

  test("renders an existing recipe from route state", async () => {
    renderRecipePage({
      pathname: "/Recipe",
      state: {
        existingRecipe: {
          name: "State Recipe",
          title: "State Recipe",
          ingredients: [{ name: "Egg", amount: 2, unit: "pcs" }],
          instructions: ["Cook the eggs"],
          timeToPrepare: "10 min",
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText("State Recipe")).toBeInTheDocument();
    });
    expect(screen.getByText("Cook the eggs")).toBeInTheDocument();
    expect(generateRecipe).not.toHaveBeenCalled();
  });

  test("generates recipes from a search prompt", async () => {
    vi.mocked(generateRecipe).mockResolvedValue({
      recipes: [
        {
          name: "Generated Recipe",
          description: "Generated from pantry items",
          ingredients: [{ name: "Egg", amount: 2, unit: "pcs" }],
          instructions: ["Cook the eggs"],
          timeToPrepare: "10 min",
        },
      ],
    });

    renderRecipePage({
      pathname: "/Recipe",
      state: {
        search: "quick breakfast",
      },
    });

    await waitFor(() => {
      expect(generateRecipe).toHaveBeenCalledWith(
        "quick breakfast",
        ["egg", "milk"],
        expect.any(AbortSignal),
        3,
      );
    });

    expect(await screen.findByText("Generated Recipe")).toBeInTheDocument();
    expect(screen.getByText("Cook the eggs")).toBeInTheDocument();
  });
});
