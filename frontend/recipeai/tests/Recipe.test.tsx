import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import RecipePage from "../src/pages/RecipePage";
import { apiClient, deleteClient, generateRecipe } from "../src/lib/hooks";
import { useFridge } from "../src/context/fridgeContext";
import { useUser } from "../src/context/context";
import {
  addShoppingItems,
  generateShoppingListFromRecipe,
} from "../src/lib/shoppingList";

const {
  applyFridgeOperation,
  createFridgeOperationId,
  refreshFridgeItems,
  undoFridgeOperation,
} = vi.hoisted(() => ({
  applyFridgeOperation: vi.fn(),
  createFridgeOperationId: vi.fn(),
  refreshFridgeItems: vi.fn(),
  undoFridgeOperation: vi.fn(),
}));

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

vi.mock("../src/lib/fridgeOperations", () => ({
  applyFridgeOperation,
  createFridgeOperationId,
  undoFridgeOperation,
}));

const LoginRouteProbe = () => {
  const location = useLocation();
  const fromPathname =
    (
      location.state as {
        from?: { pathname?: string };
      } | null
    )?.from?.pathname ?? "";

  return <div>Login Page::{fromPathname}</div>;
};

const renderRecipePage = (
  initialEntry: string | { pathname: string; state?: unknown },
) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/Recipe" element={<RecipePage />} />
        <Route path="/Recipe/:id" element={<RecipePage />} />
        <Route path="/ShoppingList" element={<div>Shopping List Page</div>} />
        <Route path="/login" element={<LoginRouteProbe />} />
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
      refreshFridgeItems,
      getFridgeItemNames: vi.fn(() => ["egg", "milk"]),
    });

    vi.mocked(apiClient).mockResolvedValue({});
    vi.mocked(generateRecipe).mockResolvedValue({});
    vi.mocked(deleteClient).mockResolvedValue({});
    vi.mocked(generateShoppingListFromRecipe).mockResolvedValue([]);
    applyFridgeOperation.mockResolvedValue({
      operationId: "cook-operation",
      status: "APPLIED",
      appliedChanges: [],
      skippedChanges: [],
      currentItems: [],
    });
    undoFridgeOperation.mockResolvedValue({
      operationId: "undo-operation",
      status: "APPLIED",
      appliedChanges: [],
      skippedChanges: [],
      currentItems: [],
    });
    createFridgeOperationId
      .mockReset()
      .mockReturnValueOnce("cook-operation")
      .mockReturnValueOnce("undo-operation");
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

  test("presents fridge matches as useful context instead of praising missing items", async () => {
    renderRecipePage({
      pathname: "/Recipe",
      state: {
        existingRecipe: {
          name: "Olive rice",
          title: "Olive rice",
          ingredients: [
            { name: "Olive oil", amount: 30, unit: "ml" },
            { name: "Rice", amount: 200, unit: "g" },
          ],
          instructions: ["Cook"],
          timeToPrepare: "20 min",
          fridgeCoverage: {
            available: ["Olive oil"],
            missing: [{ name: "Rice", amount: 200, unit: "g" }],
            unresolved: [],
            coverageRatio: 0.5,
            explanation: "Already in your fridge: Olive oil.",
          },
        },
      },
    });

    expect(await screen.findByText("Fridge match")).toBeInTheDocument();
    expect(screen.getByText("Ready from your fridge: 1")).toBeInTheDocument();
    expect(screen.getByText("50% covered")).toBeInTheDocument();
    expect(screen.getByText("✓ Olive oil")).toBeInTheDocument();
    expect(screen.queryByText("Nothing from your fridge is needed")).not.toBeInTheDocument();
    expect(screen.getByText(/Already in your fridge: Olive oil/)).toBeInTheDocument();
  });

  test("keeps and displays the recipe content language when saving", async () => {
    renderRecipePage({
      pathname: "/Recipe",
      state: {
        existingRecipe: {
          name: "Zupa pomidorowa",
          title: "Zupa pomidorowa",
          locale: "pl",
          ingredients: [{ name: "Pomidor", amount: 4, unit: "szt." }],
          instructions: ["Ugotuj pomidory"],
          timeToPrepare: "30 min",
        },
      },
    });

    expect(await screen.findByText("Polish recipe")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Recipe" }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        "addRecipe",
        true,
        expect.objectContaining({
          name: "Zupa pomidorowa",
          locale: "pl",
        }),
      );
    });
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
    let resolveShoppingListGeneration:
      | ((value: { name: string; amount: number; unit: string }[]) => void)
      | undefined;

    vi.mocked(generateShoppingListFromRecipe).mockReturnValue(
      new Promise((resolve) => {
        resolveShoppingListGeneration = resolve;
      }),
    );

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

    expect(
      await screen.findByRole("button", {
        name: /Generating Shopping List/i,
      }),
    ).toBeDisabled();

    await waitFor(() => {
      expect(generateShoppingListFromRecipe).toHaveBeenCalledWith([
        { name: "Egg", amount: 2, unit: "pcs" },
        { name: "Flour", amount: 200, unit: "g" },
      ]);
    });

    await act(async () => {
      resolveShoppingListGeneration?.([
        { name: "Flour", amount: 200, unit: "g" },
      ]);
    });

    await waitFor(() => {
      expect(addShoppingItems).toHaveBeenCalledWith([
        { name: "Flour", amount: 200, unit: "g" },
      ]);
    });
    expect(await screen.findByText("Shopping List Page")).toBeInTheDocument();
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

  test("marks a recipe cooked, consumes matching fridge amounts, and can undo", async () => {
    vi.mocked(useFridge).mockReturnValue({
      fridgeItems: [
        { id: 8, name: "Tomatoes", expirationDate: null, amount: 500, unit: "g" },
        { id: 9, name: "Basil", expirationDate: null, amount: "", unit: "g" },
      ],
      setFridgeItems: vi.fn(),
      loading: false,
      error: "",
      addFridgeItem: vi.fn(),
      addFridgeItemsBatch: vi.fn(),
      removeFridgeItem: vi.fn(),
      updateFridgeItem: vi.fn(),
      refreshFridgeItems,
      getFridgeItemNames: vi.fn(() => ["Tomatoes", "Basil"]),
    });

    renderRecipePage({
      pathname: "/Recipe",
      state: {
        existingRecipe: {
          name: "Tomato pasta",
          title: "Tomato pasta",
          ingredients: [
            { name: "Tomato", amount: 200, unit: "g" },
            { name: "Basil", amount: 12, unit: "g" },
          ],
          instructions: ["Cook"],
          timeToPrepare: "20 min",
        },
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: /Cooked/i }));

    await waitFor(() =>
      expect(applyFridgeOperation).toHaveBeenCalledWith({
        operationId: "cook-operation",
        source: "COOKED_RECIPE",
        sourceReference: "recipe:Tomato pasta",
        changes: [
          expect.objectContaining({
            type: "DECREMENT",
            fridgeItemId: 8,
            amount: 200,
          }),
          expect.objectContaining({
            type: "FINISH",
            fridgeItemId: 9,
          }),
        ],
      }),
    );
    expect(refreshFridgeItems).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Fridge updated after cooking.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(undoFridgeOperation).toHaveBeenCalledWith(
        "cook-operation",
        "undo-operation",
      ),
    );
    expect(refreshFridgeItems).toHaveBeenCalledTimes(2);
  });

  test("guest on a public recipe page sees a login CTA for shopping list generation", async () => {
    vi.mocked(useUser).mockReturnValue({
      user: null,
    } as ReturnType<typeof useUser>);

    vi.mocked(apiClient).mockResolvedValue({
      id: "101",
      title: "Tomato Basil Pasta",
      name: "Tomato Basil Pasta",
      description: "A bright pantry pasta",
      ingredients: [{ name: "Tomato", amount: 200, unit: "g" }],
      instructions: ["Boil pasta"],
      timeToPrepare: "25 min",
    });

    renderRecipePage("/Recipe/101");

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Log In to Generate Shopping List",
      }),
    );

    expect(generateShoppingListFromRecipe).not.toHaveBeenCalled();
    expect(addShoppingItems).not.toHaveBeenCalled();
    expect(await screen.findByText("Login Page::/Recipe/101")).toBeInTheDocument();
  });

  test("does not show management controls for another user's public recipe", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      id: "101",
      title: "Community Pasta",
      name: "Community Pasta",
      ingredients: [{ name: "Tomato", amount: 200, unit: "g" }],
      instructions: ["Boil pasta"],
      timeToPrepare: "25 min",
      visibility: "PUBLIC",
      canManage: false,
    });

    renderRecipePage("/Recipe/101");

    expect(await screen.findByText("Community Pasta")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unpublish Recipe" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete Recipe" }),
    ).not.toBeInTheDocument();
  });

  test("shows management controls when the backend grants permission", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      id: "102",
      title: "My Pasta",
      name: "My Pasta",
      ingredients: [{ name: "Tomato", amount: 200, unit: "g" }],
      instructions: ["Boil pasta"],
      timeToPrepare: "25 min",
      visibility: "PUBLIC",
      canManage: true,
    });

    renderRecipePage("/Recipe/102");

    expect(
      await screen.findByRole("button", { name: "Unpublish Recipe" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Recipe" }),
    ).toBeInTheDocument();
  });
});
