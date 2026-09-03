import type { FridgeIngredient } from "../context/fridgeContext";
import type { RecipeIngredient } from "../pages/RecipePage";

export interface CookedRecipeFridgeChange {
  type: "DECREMENT" | "FINISH";
  clientChangeId: string;
  fridgeItemId: number;
  amount?: number;
  quantityAccuracy: "EXACT";
}

type UnitGroup = "mass" | "volume" | "pieces" | "unknown";

interface NormalizedUnit {
  group: UnitGroup;
  factor: number;
}

const normalizeIngredientName = (name: string) => {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return normalized
    .split(" ")
    .map((word) => {
      if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);
      if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
      if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
        return word.slice(0, -1);
      }
      return word;
    })
    .join(" ");
};

const ingredientNameMatchScore = (recipeName: string, fridgeName: string) => {
  if (recipeName === fridgeName) {
    return 2;
  }

  const recipeWords = recipeName.split(" ");
  const fridgeWords = fridgeName.split(" ");
  const recipeContainsFridge = fridgeWords.every((word) => recipeWords.includes(word));
  const fridgeContainsRecipe = recipeWords.every((word) => fridgeWords.includes(word));
  return recipeContainsFridge || fridgeContainsRecipe ? 1 : 0;
};

const normalizeUnit = (unit: string | null | undefined): NormalizedUnit | null => {
  const normalized = (unit ?? "").trim().toLowerCase().replace(/\.$/, "");
  const units: Record<string, NormalizedUnit> = {
    g: { group: "mass", factor: 1 },
    gram: { group: "mass", factor: 1 },
    grams: { group: "mass", factor: 1 },
    kg: { group: "mass", factor: 1000 },
    kilogram: { group: "mass", factor: 1000 },
    kilograms: { group: "mass", factor: 1000 },
    ml: { group: "volume", factor: 1 },
    milliliter: { group: "volume", factor: 1 },
    milliliters: { group: "volume", factor: 1 },
    l: { group: "volume", factor: 1000 },
    liter: { group: "volume", factor: 1000 },
    liters: { group: "volume", factor: 1000 },
    pcs: { group: "pieces", factor: 1 },
    piece: { group: "pieces", factor: 1 },
    pieces: { group: "pieces", factor: 1 },
    szt: { group: "pieces", factor: 1 },
    "": { group: "unknown", factor: 1 },
  };

  return units[normalized] ?? null;
};

const parsePositiveAmount = (amount: string | number | null | undefined) => {
  if (typeof amount === "number") {
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }
  if (typeof amount !== "string" || !amount.trim()) {
    return null;
  }

  const parsed = Number(amount.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const roundAmount = (amount: number) => Number(amount.toFixed(6));

export const buildCookedRecipeFridgeChanges = (
  ingredients: RecipeIngredient[],
  fridgeItems: FridgeIngredient[],
): CookedRecipeFridgeChange[] => {
  const availableById = new Map<number, number>();
  const decrementById = new Map<number, number>();
  const finishedIds = new Set<number>();

  for (const ingredient of ingredients) {
    const requiredAmount = parsePositiveAmount(ingredient.amount);
    const recipeUnit = normalizeUnit(ingredient.unit);
    if (!requiredAmount || !recipeUnit) {
      continue;
    }

    const ingredientName = normalizeIngredientName(ingredient.name);
    let remainingBaseAmount = requiredAmount * recipeUnit.factor;
    const matchingItems = fridgeItems
      .map((item, index) => ({
        item,
        index,
        score: ingredientNameMatchScore(
          ingredientName,
          normalizeIngredientName(item.name),
        ),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index);

    for (const { item: fridgeItem } of matchingItems) {
      if (remainingBaseAmount <= 0) {
        break;
      }
      if (finishedIds.has(fridgeItem.id)) {
        continue;
      }

      const fridgeAmount = parsePositiveAmount(fridgeItem.amount);
      if (!fridgeAmount) {
        finishedIds.add(fridgeItem.id);
        remainingBaseAmount = 0;
        break;
      }

      const fridgeUnit = normalizeUnit(fridgeItem.unit);
      if (!fridgeUnit || fridgeUnit.group !== recipeUnit.group) {
        continue;
      }

      const availableBaseAmount =
        availableById.get(fridgeItem.id) ?? fridgeAmount * fridgeUnit.factor;
      if (availableBaseAmount <= 0) {
        continue;
      }

      const usedBaseAmount = Math.min(availableBaseAmount, remainingBaseAmount);
      availableById.set(fridgeItem.id, availableBaseAmount - usedBaseAmount);
      decrementById.set(
        fridgeItem.id,
        (decrementById.get(fridgeItem.id) ?? 0) + usedBaseAmount / fridgeUnit.factor,
      );
      remainingBaseAmount -= usedBaseAmount;
    }
  }

  return fridgeItems.flatMap((item): CookedRecipeFridgeChange[] => {
    if (finishedIds.has(item.id)) {
      return [{
        type: "FINISH",
        clientChangeId: `cooked-${item.id}`,
        fridgeItemId: item.id,
        quantityAccuracy: "EXACT",
      }];
    }

    const amount = decrementById.get(item.id);
    return amount
      ? [{
          type: "DECREMENT",
          clientChangeId: `cooked-${item.id}`,
          fridgeItemId: item.id,
          amount: roundAmount(amount),
          quantityAccuracy: "EXACT",
        }]
      : [];
  });
};
