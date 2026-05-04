import { apiClient, putClient } from "./hooks";

export interface ShoppingListItem {
  id: string;
  name: string;
  amount?: string | number | null;
  unit?: string | null;
  checked: boolean;
  createdAt: string;
}

interface ShoppingItemInput {
  name: string;
  amount?: string | number | null;
  unit?: string | null;
}

type RawShoppingListItem = Partial<ShoppingListItem> & {
  id?: string;
  name?: string;
  amount?: string | number | null;
  unit?: string | null;
  checked?: boolean;
  createdAt?: string;
};

const STORAGE_KEY = "recipeai.shoppingList";

const normalizeName = (value: string) => value.trim().toLowerCase();
const normalizeUnit = (value: string | null | undefined) =>
  typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
export const createShoppingListItemId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const toNumberOrNull = (
  value: string | number | null | undefined,
): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const toRawShoppingListItem = (item: unknown): RawShoppingListItem | null => {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const parsed: RawShoppingListItem = {};

  if (typeof raw.id === "string") {
    parsed.id = raw.id;
  }
  if (typeof raw.name === "string") {
    parsed.name = raw.name;
  }
  if (
    typeof raw.amount === "string" ||
    typeof raw.amount === "number" ||
    raw.amount === null
  ) {
    parsed.amount = raw.amount;
  }
  if (typeof raw.unit === "string" || raw.unit === null) {
    parsed.unit = raw.unit;
  }
  if (typeof raw.checked === "boolean") {
    parsed.checked = raw.checked;
  }
  if (typeof raw.createdAt === "string") {
    parsed.createdAt = raw.createdAt;
  }

  return parsed;
};

const normalizeRemoteItem = (
  item: RawShoppingListItem,
): ShoppingListItem | null => {
  if (!item || typeof item !== "object") {
    return null;
  }

  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!name) {
    return null;
  }

  return {
    id:
      typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : createShoppingListItemId(),
    name,
    amount: toNumberOrNull(item.amount),
    unit:
      typeof item.unit === "string" && item.unit.trim()
        ? item.unit.trim()
        : null,
    checked: Boolean(item.checked),
    createdAt:
      typeof item.createdAt === "string" && item.createdAt.trim()
        ? item.createdAt
        : new Date().toISOString(),
  };
};

export const normalizeShoppingListItems = (
  items: unknown,
): ShoppingListItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map(toRawShoppingListItem)
    .filter((item): item is RawShoppingListItem => item !== null)
    .map((item) => normalizeRemoteItem(item))
    .filter((item): item is ShoppingListItem => item !== null);
};

export const getShoppingListFingerprint = (items: ShoppingListItem[]): string =>
  JSON.stringify(
    items.map((item) => ({
      id: item.id,
      name: item.name,
      amount: toNumberOrNull(item.amount),
      unit: item.unit ?? null,
      checked: Boolean(item.checked),
      createdAt: item.createdAt,
    })),
  );

const toSyncPayloadItem = (item: ShoppingListItem) => ({
  id: item.id,
  name: item.name,
  amount: toNumberOrNull(item.amount),
  unit: item.unit ?? null,
  checked: item.checked,
  createdAt: item.createdAt,
});

export const readShoppingList = (): ShoppingListItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return normalizeShoppingListItems(parsed);
  } catch {
    return [];
  }
};

export const writeShoppingList = (items: ShoppingListItem[]) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(normalizeShoppingListItems(items)),
  );
};

export const addShoppingItems = (
  newItems: ShoppingItemInput[],
): ShoppingListItem[] => {
  const existing = readShoppingList();
  const updated = [...existing];

  for (const item of newItems) {
    if (!item.name || item.name.trim() === "") {
      continue;
    }

    const incomingName = item.name.trim();
    const incomingNameKey = normalizeName(incomingName);
    const incomingUnit = normalizeUnit(item.unit);
    const incomingAmount = toNumberOrNull(item.amount);

    const sameNameIndexes = updated
      .map((existingItem, index) =>
        normalizeName(existingItem.name) === incomingNameKey ? index : -1,
      )
      .filter((index) => index !== -1);

    if (sameNameIndexes.length === 0) {
      updated.push({
        id: createShoppingListItemId(),
        name: incomingName,
        amount: incomingAmount,
        unit: item.unit ?? null,
        checked: false,
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    const compatibleIndex = sameNameIndexes.find((index) => {
      const existingUnit = normalizeUnit(updated[index].unit);
      return (
        existingUnit === incomingUnit ||
        existingUnit === null ||
        incomingUnit === null
      );
    });

    if (compatibleIndex === undefined) {
      updated.push({
        id: createShoppingListItemId(),
        name: incomingName,
        amount: incomingAmount,
        unit: item.unit ?? null,
        checked: false,
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    const existingItem = updated[compatibleIndex];
    const existingAmount = toNumberOrNull(existingItem.amount);

    if (incomingAmount !== null) {
      if (existingAmount !== null) {
        existingItem.amount = Number(
          (existingAmount + incomingAmount).toFixed(2),
        );
      } else {
        existingItem.amount = incomingAmount;
      }
    }

    if (!existingItem.unit && item.unit) {
      existingItem.unit = item.unit;
    }

    existingItem.checked = false;
  }

  writeShoppingList(updated);
  return updated;
};

export const fetchShoppingList = async (): Promise<ShoppingListItem[]> => {
  const response = await apiClient("shoppingList");

  return normalizeShoppingListItems(response);
};

export const syncShoppingList = async (
  items: ShoppingListItem[],
): Promise<ShoppingListItem[]> => {
  const response = await putClient("shoppingList", {
    items: normalizeShoppingListItems(items).map(toSyncPayloadItem),
  });

  return normalizeShoppingListItems(response);
};
