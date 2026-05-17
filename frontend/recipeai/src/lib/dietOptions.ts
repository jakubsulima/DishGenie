export interface DietOptionDescriptor {
  value: string;
  label: string;
  description: string;
  group: DietGroupId;
}

export type DietGroupId = "general" | "restrictions" | "goals";

export interface DietOptionGroup {
  id: DietGroupId;
  label: string;
  helperText: string;
  options: DietOptionDescriptor[];
}

const GROUP_META: Record<DietGroupId, { label: string; helperText: string }> = {
  general: {
    label: "Diet styles",
    helperText: "General eating patterns and preferred food styles.",
  },
  restrictions: {
    label: "Restrictions",
    helperText: "Foods your body cannot tolerate or you want to avoid.",
  },
  goals: {
    label: "Nutrition goals",
    helperText: "Macro-focused preferences for training or satiety.",
  },
};

const DIET_METADATA: Record<
  string,
  { label: string; description: string; group: DietGroupId }
> = {
  NONE: {
    label: "No specific diet",
    description: "Balanced recipe mix with no diet restrictions.",
    group: "general",
  },
  VEGETARIAN: {
    label: "Vegetarian",
    description: "No meat or fish. Includes eggs and dairy.",
    group: "general",
  },
  VEGAN: {
    label: "Vegan",
    description: "Plant-based only. No meat, fish, dairy, eggs, or honey.",
    group: "general",
  },
  GLUTEN_FREE: {
    label: "Gluten-free",
    description: "Excludes wheat, barley, and rye ingredients.",
    group: "restrictions",
  },
  DAIRY_FREE: {
    label: "Dairy-free",
    description: "No milk, cheese, butter, cream, or yogurt.",
    group: "restrictions",
  },
  KETO: {
    label: "Keto",
    description: "Very low carb and high fat meals.",
    group: "goals",
  },
  PALEO: {
    label: "Paleo",
    description: "Whole-food focus with no grains, legumes, or dairy.",
    group: "general",
  },
  MEDITERRANEAN: {
    label: "Mediterranean",
    description: "Vegetables, legumes, whole grains, fish, and olive oil.",
    group: "general",
  },
  LOW_CARB: {
    label: "Low carb",
    description: "Reduced carbohydrates with higher protein and fats.",
    group: "goals",
  },
  HIGH_PROTEIN: {
    label: "High protein",
    description: "Protein-forward meals to support satiety and recovery.",
    group: "goals",
  },
  OTHER: {
    label: "Other",
    description: "Custom or mixed dietary approach.",
    group: "general",
  },
};

const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const normalizeDietValue = (value: string): string =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

export const getDietLabel = (value: string): string => {
  const normalized = normalizeDietValue(value);
  return DIET_METADATA[normalized]?.label ?? toTitleCase(normalized);
};

const getDietDescription = (value: string): string => {
  const normalized = normalizeDietValue(value);
  return (
    DIET_METADATA[normalized]?.description ??
    "Diet preference used to tune recipe suggestions."
  );
};

const getDietGroup = (value: string): DietGroupId => {
  const normalized = normalizeDietValue(value);
  return DIET_METADATA[normalized]?.group ?? "general";
};

const getDietOptionDescriptors = (
  values: string[],
): DietOptionDescriptor[] => {
  const unique = values.filter(
    (value, index, arr) => arr.indexOf(value) === index,
  );

  return unique.map((value) => {
    const normalized = normalizeDietValue(value);
    return {
      value: normalized,
      label: getDietLabel(normalized),
      description: getDietDescription(normalized),
      group: getDietGroup(normalized),
    };
  });
};

export const getDietOptionGroups = (values: string[]): DietOptionGroup[] => {
  const options = getDietOptionDescriptors(values);
  const grouped = options.reduce<Record<DietGroupId, DietOptionDescriptor[]>>(
    (acc, option) => {
      acc[option.group].push(option);
      return acc;
    },
    { general: [], restrictions: [], goals: [] },
  );

  return (Object.keys(GROUP_META) as DietGroupId[])
    .map((groupId) => ({
      id: groupId,
      label: GROUP_META[groupId].label,
      helperText: GROUP_META[groupId].helperText,
      options: grouped[groupId],
    }))
    .filter((group) => group.options.length > 0);
};
