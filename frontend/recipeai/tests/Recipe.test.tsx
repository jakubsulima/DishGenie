import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RecipePage from "../src/pages/RecipePage";
import { apiClient, deleteClient, generateRecipe } from "../src/lib/hooks";
import { useFridge } from "../src/context/fridgeContext";
import { useUser } from "../src/context/context";
import {
  addShoppingItems,
  generateShoppingListFromRecipe,
} from "../src/lib/shoppingList";

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
  generateShoppingListFromRecipe: vi.fn(),
}));

const renderRecipePage = (
  initialEntry: string | { pathname: string; state?: unknown },
) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/Recipe" element={<RecipePage />} />
        <Route path="/Recipe/:id" element={<RecipePage />} />
        <Route path="/ShoppingList" element={<div>Shopping List Page</div>} />
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
    vi.mocked(generateShoppingListFromRecipe).mockResolvedValue([]);
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

  test("uses smart shopping list generation and adds only returned items", async () => {
    vi.mocked(generateShoppingListFromRecipe).mockResolvedValue([
      { name: "Flour", amount: 200, unit: "g" },
    ]);

    renderRecipePage({
      pathname: "/Recipe",
      state: {
        existingRecipe: {
          name: "Pancakes",
          title: "Pancakes",
          ingredients: [
            { name: "Egg", amount: 2, unit: "pcs" },
            { name: "Flour", amount: 200, unit: "g" },
          ],
          instructions: ["Mix and cook"],
          timeToPrepare: "15 min",
        },
      },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Generate Shopping List" }),
    );

    await waitFor(() => {
      expect(generateShoppingListFromRecipe).toHaveBeenCalledWith([
        { name: "Egg", amount: 2, unit: "pcs" },
        { name: "Flour", amount: 200, unit: "g" },
      ]);
    });

    expect(addShoppingItems).toHaveBeenCalledWith([
      { name: "Flour", amount: 200, unit: "g" },
    ]);
    expect(await screen.findByText("Shopping List Page")).toBeInTheDocument();
  });

  test("falls back to local fridge matching when smart shopping list generation fails", async () => {
    vi.mocked(generateShoppingListFromRecipe).mockRejectedValue(
      new Error("backend unavailable"),
    );

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
      getFridgeItemNames: vi.fn(() => []),
    });

    renderRecipePage({
      pathname: "/Recipe",
      state: {
        existingRecipe: {
          name: "Soup",
          title: "Soup",
          ingredients: [{ name: "Broth", amount: 500, unit: "ml" }],
          instructions: ["Simmer"],
          timeToPrepare: "20 min",
        },
      },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Generate Shopping List" }),
    );

    await waitFor(() => {
      expect(addShoppingItems).toHaveBeenCalledWith([
        { name: "Broth", amount: 500, unit: "ml" },
      ]);
    });
  });

  test("does not add the full recipe when smart generation fails and fridge already covers it", async () => {
    vi.mocked(generateShoppingListFromRecipe).mockRejectedValue(
      new Error("backend unavailable"),
    );

    vi.mocked(useFridge).mockReturnValue({
      fridgeItems: [
        {
          id: 1,
          name: "Egg",
          expirationDate: null,
          amount: 4,
          unit: "pcs",
        },
      ],
      setFridgeItems: vi.fn(),
      loading: false,
      error: "",
      addFridgeItem: vi.fn(),
      addFridgeItemsBatch: vi.fn(),
      removeFridgeItem: vi.fn(),
      updateFridgeItem: vi.fn(),
      refreshFridgeItems: vi.fn(),
      getFridgeItemNames: vi.fn(() => ["Egg"]),
    });

    renderRecipePage({
      pathname: "/Recipe",
      state: {
        existingRecipe: {
          name: "Omelette",
          title: "Omelette",
          ingredients: [{ name: "Egg", amount: 2, unit: "pcs" }],
          instructions: ["Cook gently"],
          timeToPrepare: "8 min",
        },
      },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Generate Shopping List" }),
    );

    await waitFor(() => {
      expect(addShoppingItems).toHaveBeenCalledWith([]);
    });
  });

  test("navigates to shopping list even when no items need to be added", async () => {
    vi.mocked(generateShoppingListFromRecipe).mockResolvedValue([]);

    renderRecipePage({
      pathname: "/Recipe",
      state: {
        existingRecipe: {
          name: "Omelette",
          title: "Omelette",
          ingredients: [{ name: "Egg", amount: 2, unit: "pcs" }],
          instructions: ["Cook gently"],
          timeToPrepare: "8 min",
        },
      },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Generate Shopping List" }),
    );

    await waitFor(() => {
      expect(addShoppingItems).toHaveBeenCalledWith([]);
    });

    expect(await screen.findByText("Shopping List Page")).toBeInTheDocument();
  });
});
