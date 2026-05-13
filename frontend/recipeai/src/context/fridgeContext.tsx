import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { apiClient, deleteClient } from "../lib/hooks";
import { useUser } from "./context";

/* eslint-disable react-refresh/only-export-components */

export interface FridgeIngredient {
  id: number;
  name: string;
  expirationDate: string | null;
  amount?: string | number;
  unit: unitType;
}

export interface AddFridgeIngredientInput {
  name: string;
  expirationDate: string | null;
  amount?: string | number;
  unit: unitType;
}

export interface FridgeContextType {
  fridgeItems: FridgeIngredient[];
  setFridgeItems: React.Dispatch<React.SetStateAction<FridgeIngredient[]>>;
  loading: boolean;
  error: string;
  addFridgeItem: (item: AddFridgeIngredientInput) => Promise<void>;
  addFridgeItemsBatch: (items: AddFridgeIngredientInput[]) => Promise<void>;
  removeFridgeItem: (id: number) => Promise<void>;
  updateFridgeItem: (id: number, newAmount: string) => Promise<void>;
  refreshFridgeItems: () => Promise<void>;
  getFridgeItemNames: () => string[];
}

export const UNITS = {
  g: "GRAMS",
  kg: "KILOGRAMS",
  ml: "MILLILITERS",
  l: "LITERS",
  pcs: "PIECES",
  "": "",
} as const;

export type unitType = keyof typeof UNITS;

export const UNIT_OPTIONS: unitType[] = Object.keys(UNITS) as unitType[];
export const UNIT_VALUES = Object.values(UNITS);
const BATCH_ADD_CONCURRENCY = 4;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
};

const FridgeContext = createContext<FridgeContextType>(null!);

export const useFridge = () => {
  const context = useContext(FridgeContext);
  if (!context) {
    throw new Error("useFridge must be used within a FridgeProvider");
  }
  return context;
};

export const FridgeProvider = ({ children }: { children: React.ReactNode }) => {
  const [fridgeItems, setFridgeItems] = useState<FridgeIngredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const { user, loading: userLoading } = useUser();

  const refreshFridgeItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient<FridgeIngredient[]>(
        "getFridgeIngredients",
        false,
      );
      setFridgeItems(response);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to fetch fridge items"));
    } finally {
      setLoading(false);
    }
  }, []);

  const addFridgeItem = useCallback(
    async (item: AddFridgeIngredientInput) => {
      try {
        await apiClient("addFridgeIngredient", true, {
          name: item.name,
          expirationDate: item.expirationDate,
          amount: item.amount,
          unit: UNITS[item.unit],
        });

        await refreshFridgeItems();
      } catch {
        throw new Error("Failed to add fridge item");
      }
    },
    [refreshFridgeItems],
  );

  const addFridgeItemsBatch = useCallback(
    async (items: AddFridgeIngredientInput[]) => {
      if (items.length === 0) {
        return;
      }

      try {
        for (let i = 0; i < items.length; i += BATCH_ADD_CONCURRENCY) {
          const chunk = items.slice(i, i + BATCH_ADD_CONCURRENCY);
          await Promise.all(
            chunk.map((item) =>
              apiClient("addFridgeIngredient", true, {
                name: item.name,
                expirationDate: item.expirationDate,
                amount: item.amount,
                unit: UNITS[item.unit],
              }),
            ),
          );
        }

        await refreshFridgeItems();
      } catch {
        throw new Error("Failed to add scanned items");
      }
    },
    [refreshFridgeItems],
  );

  const removeFridgeItem = useCallback(async (id: number) => {
    try {
      await deleteClient(`deleteFridgeIngredient/${id}`);
      setFridgeItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      throw new Error("Failed to remove fridge item");
    }
  }, []);

  const updateFridgeItem = useCallback(
    async (id: number, newAmount: string) => {
      try {
        await apiClient(`updateFridgeIngredient/${id}`, true, {
          amount: newAmount,
        });
        setFridgeItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, amount: newAmount } : item,
          ),
        );
      } catch {
        throw new Error("Failed to update fridge item");
      }
    },
    [],
  );

  const getFridgeItemNames = useCallback(() => {
    return fridgeItems.map((item) => item.name);
  }, [fridgeItems]);

  useEffect(() => {
    if (userLoading) {
      return;
    }

    if (!user || !user.id) {
      setFridgeItems([]);
      return;
    }

    refreshFridgeItems();
  }, [user, userLoading, refreshFridgeItems]);

  const value: FridgeContextType = useMemo(
    () => ({
      fridgeItems,
      setFridgeItems,
      loading,
      error,
      addFridgeItem,
      addFridgeItemsBatch,
      removeFridgeItem,
      updateFridgeItem,
      refreshFridgeItems,
      getFridgeItemNames,
    }),
    [
      fridgeItems,
      loading,
      error,
      addFridgeItem,
      addFridgeItemsBatch,
      removeFridgeItem,
      updateFridgeItem,
      refreshFridgeItems,
      getFridgeItemNames,
    ],
  );

  return (
    <FridgeContext.Provider value={value}>{children}</FridgeContext.Provider>
  );
};
