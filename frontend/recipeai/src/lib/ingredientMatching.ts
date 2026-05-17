interface IngredientQuantity {
  name: string;
  amount: string | number | null | undefined;
  unit: string | null | undefined;
}

interface FridgeItemQuantity {
  name: string;
  amount?: string | number | null;
  unit?: string | null;
}

type SupportedUnit = "g" | "kg" | "ml" | "l" | "pcs";
type BaseUnit = "g" | "ml" | "pcs";

const UNIT_ALIASES: Record<string, SupportedUnit> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  pcs: "pcs",
  pc: "pcs",
  piece: "pcs",
  pieces: "pcs",
  unit: "pcs",
  units: "pcs",
  GRAMS: "g",
  KILOGRAMS: "kg",
  MILLILITERS: "ml",
  LITERS: "l",
  PIECES: "pcs",
};

const UNIT_CONVERSION: Record<
  SupportedUnit,
  { base: BaseUnit; factor: number }
> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
  pcs: { base: "pcs", factor: 1 },
};

const normalizeIngredientName = (name: string): string =>
  name.trim().toLowerCase();

const normalizeUnit = (
  unit: string | null | undefined,
): SupportedUnit | null => {
  if (!unit) {
    return null;
  }

  const normalized = unit.trim();
  if (!normalized) {
    return null;
  }

  return (
    UNIT_ALIASES[normalized] ?? UNIT_ALIASES[normalized.toLowerCase()] ?? null
  );
};

const parseAmountValue = (
  amount: string | number | null | undefined,
): number | null => {
  if (amount === null || amount === undefined) {
    return null;
  }

  if (typeof amount === "number") {
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  const normalized = amount.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const mixedFractionMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedFractionMatch) {
    const whole = Number.parseFloat(mixedFractionMatch[1]);
    const numerator = Number.parseFloat(mixedFractionMatch[2]);
    const denominator = Number.parseFloat(mixedFractionMatch[3]);
    if (denominator > 0) {
      const parsed = whole + numerator / denominator;
      return parsed > 0 ? parsed : null;
    }
  }

  const fractionMatch = normalized.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = Number.parseFloat(fractionMatch[1]);
    const denominator = Number.parseFloat(fractionMatch[2]);
    if (denominator > 0) {
      const parsed = numerator / denominator;
      return parsed > 0 ? parsed : null;
    }
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toBaseAmount = (amount: number, unit: SupportedUnit): number =>
  amount * UNIT_CONVERSION[unit].factor;

const fromBaseAmount = (amount: number, unit: SupportedUnit): number =>
  amount / UNIT_CONVERSION[unit].factor;

const roundAmount = (amount: number): number => Math.round(amount * 100) / 100;

export const getMissingIngredients = <T extends IngredientQuantity>(
  recipeIngredients: T[],
  fridgeItems: FridgeItemQuantity[],
): T[] => {
  const fridgeItemsByName = new Map<string, FridgeItemQuantity[]>();

  for (const fridgeItem of fridgeItems) {
    const normalizedName = normalizeIngredientName(fridgeItem.name || "");
    if (!normalizedName) {
      continue;
    }

    const currentItems = fridgeItemsByName.get(normalizedName) ?? [];
    currentItems.push(fridgeItem);
    fridgeItemsByName.set(normalizedName, currentItems);
  }

  const missingIngredients: T[] = [];

  for (const ingredient of recipeIngredients) {
    const normalizedName = normalizeIngredientName(ingredient.name || "");
    if (!normalizedName) {
      continue;
    }

    const matchingFridgeItems = fridgeItemsByName.get(normalizedName) ?? [];
    if (matchingFridgeItems.length === 0) {
      missingIngredients.push(ingredient);
      continue;
    }

    const requiredAmount = parseAmountValue(ingredient.amount);
    const requiredUnit = normalizeUnit(ingredient.unit);

    if (requiredAmount === null || requiredUnit === null) {
      continue;
    }

    const requiredMeta = UNIT_CONVERSION[requiredUnit];
    const requiredBaseAmount = toBaseAmount(requiredAmount, requiredUnit);

    let availableBaseAmount = 0;
    let hasCompatibleMeasuredItem = false;
    let hasUnmeasuredMatch = false;

    for (const fridgeItem of matchingFridgeItems) {
      const fridgeAmount = parseAmountValue(fridgeItem.amount);
      const fridgeUnit = normalizeUnit(fridgeItem.unit);

      if (fridgeAmount === null || fridgeUnit === null) {
        hasUnmeasuredMatch = true;
        continue;
      }

      const fridgeMeta = UNIT_CONVERSION[fridgeUnit];
      if (fridgeMeta.base !== requiredMeta.base) {
        continue;
      }

      hasCompatibleMeasuredItem = true;
      availableBaseAmount += toBaseAmount(fridgeAmount, fridgeUnit);
    }

    if (hasCompatibleMeasuredItem && availableBaseAmount < requiredBaseAmount) {
      const missingAmount = roundAmount(
        fromBaseAmount(requiredBaseAmount - availableBaseAmount, requiredUnit),
      );

      missingIngredients.push({
        ...ingredient,
        amount: missingAmount,
        unit: ingredient.unit || requiredUnit,
      });
      continue;
    }

    if (!hasCompatibleMeasuredItem && !hasUnmeasuredMatch) {
      missingIngredients.push(ingredient);
    }
  }

  return missingIngredients;
};
