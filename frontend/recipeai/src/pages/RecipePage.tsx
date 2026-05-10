import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  apiClient,
  generateRecipe,
  deleteClient,
  cleanAiJsonString,
} from "../lib/hooks";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFridge } from "../context/fridgeContext.tsx";
import { useUser } from "../context/context";
import FoodLoadingScreen from "../components/FoodLoadingScreen";
import { addShoppingItems } from "../lib/shoppingList";
import ErrorAlert from "../components/ErrorAlert";
import { getMissingIngredients } from "../lib/ingredientMatching";
import { applySeo } from "../lib/seo";

export interface RecipeIngredient {
  name: string;
  amount: string | number | null;
  unit: string;
}

export interface RecipeData {
  title: string;
  id?: string;
  description?: string;
  name: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  timeToPrepare: string;
  nutrition?: {
    calories?: string | number;
    protein?: string | number;
    carbs?: string | number;
    fats?: string | number;
  };
}

const GENERATED_RECIPES_REQUEST_COUNT = 3;
const RECIPE_GENERATION_TIMEOUT_MS = 45000;
const GENERATION_FAILED_MESSAGE =
  "Something went wrong while generating the recipe. Please try again.";
type ApiRecord = Record<string, unknown>;

const asRecord = (value: unknown): ApiRecord | null => {
  if (value && typeof value === "object") {
    return value as ApiRecord;
  }
  return null;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return undefined;
};

const isAbortError = (error: unknown): boolean => {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
};

const formatMacro = (value: string | number | undefined, suffix: string) => {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  if (typeof value === "number") {
    return `${value}${suffix}`;
  }

  const trimmed = value.trim();
  return trimmed ? `${trimmed}${suffix}` : "-";
};

const normalizeGeneratedRecipes = (raw: unknown): RecipeData[] => {
  const rawRecord = asRecord(raw);
  const rawRecipes = rawRecord?.recipes;
  const candidates: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray(rawRecipes)
      ? rawRecipes
      : rawRecord
        ? [rawRecord]
        : [];

  return candidates
    .map((candidateValue, index: number) => {
      const candidate = asRecord(candidateValue);
      if (!candidate) {
        return null;
      }

      const name =
        typeof candidate.name === "string" && candidate.name.trim()
          ? candidate.name.trim()
          : `Recipe ${index + 1}`;

      const ingredients = Array.isArray(candidate.ingredients)
        ? candidate.ingredients
            .map((ingredientValue) => {
              const ingredient = asRecord(ingredientValue);
              if (!ingredient) {
                return null;
              }

              const ingredientName =
                typeof ingredient.name === "string"
                  ? ingredient.name.trim()
                  : "";
              if (!ingredientName) {
                return null;
              }

              return {
                name: ingredientName,
                amount:
                  ingredient.amount === undefined || ingredient.amount === null
                    ? null
                    : ingredient.amount,
                unit:
                  typeof ingredient.unit === "string"
                    ? ingredient.unit.trim()
                    : "",
              } as RecipeIngredient;
            })
            .filter(
              (
                ingredient: RecipeIngredient | null,
              ): ingredient is RecipeIngredient => ingredient !== null,
            )
        : [];

      const instructions = Array.isArray(candidate.instructions)
        ? candidate.instructions
            .map((instruction) =>
              typeof instruction === "string" ? instruction.trim() : "",
            )
            .filter((instruction: string) => instruction.length > 0)
        : [];

      const nutritionData = asRecord(candidate.nutrition);

      if (!ingredients.length || !instructions.length) {
        return null;
      }

      return {
        title: name,
        id:
          typeof candidate.id === "string"
            ? candidate.id
            : typeof candidate.id === "number"
              ? String(candidate.id)
              : undefined,
        name,
        description:
          typeof candidate.description === "string"
            ? candidate.description.trim()
            : undefined,
        ingredients,
        instructions,
        timeToPrepare:
          typeof candidate.timeToPrepare === "string" &&
          candidate.timeToPrepare.trim()
            ? candidate.timeToPrepare.trim()
            : "",
        nutrition: nutritionData
          ? {
              calories:
                typeof nutritionData.calories === "string" ||
                typeof nutritionData.calories === "number"
                  ? nutritionData.calories
                  : undefined,
              protein:
                typeof nutritionData.protein === "string" ||
                typeof nutritionData.protein === "number"
                  ? nutritionData.protein
                  : undefined,
              carbs:
                typeof nutritionData.carbs === "string" ||
                typeof nutritionData.carbs === "number"
                  ? nutritionData.carbs
                  : undefined,
              fats:
                typeof nutritionData.fats === "string" ||
                typeof nutritionData.fats === "number"
                  ? nutritionData.fats
                  : undefined,
            }
          : undefined,
      } as RecipeData;
    })
    .filter(
      (recipe: RecipeData | null): recipe is RecipeData => recipe !== null,
    );
};

const parseGeneratedRecipeResponse = (response: unknown): RecipeData[] => {
  try {
    const jsonString = cleanAiJsonString(response);
    const parsedData = JSON.parse(jsonString);
    const generatedRecipes = normalizeGeneratedRecipes(parsedData);

    if (!generatedRecipes.length) {
      throw new Error();
    }

    return generatedRecipes;
  } catch {
    throw new Error(GENERATION_FAILED_MESSAGE);
  }
};

const RecipePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const recipeId = params.id;
  const {
    fridgeItems,
    getFridgeItemNames,
    loading: fridgeLoading,
  } = useFridge();
  const { user } = useUser();

  const { search, existingRecipe } = location.state || {};
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [recipeData, setRecipeData] = useState<RecipeData | null>(null);
  const [recipeOptions, setRecipeOptions] = useState<RecipeData[]>([]);
  const [selectedRecipeIndex, setSelectedRecipeIndex] = useState(0);
  const [error, setError] = useState<string>("");
  const [generationRetryKey, setGenerationRetryKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const currentRecipeIdentifierRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const applyGeneratedRecipeResponse = useCallback(
    (response: unknown, identifier: string) => {
      const generatedRecipes = parseGeneratedRecipeResponse(response);

      setRecipeOptions(generatedRecipes);
      setSelectedRecipeIndex(0);
      setRecipeData(generatedRecipes[0]);
      setSaveStatus("idle");
      currentRecipeIdentifierRef.current = identifier;
    },
    [],
  );

  const resolveGenerationErrorMessage = (error: unknown) => {
    if (!(error instanceof Error) || !error.message) {
      return "Failed to load recipe. Please try again.";
    }

    const normalizedMessage = error.message
      .replace(/^AI Generation Error:\s*/i, "")
      .trim();
    if (!normalizedMessage) {
      return GENERATION_FAILED_MESSAGE;
    }

    if (
      normalizedMessage.startsWith("Server error (502)") ||
      normalizedMessage.includes("502")
    ) {
      return GENERATION_FAILED_MESSAGE;
    }

    return normalizedMessage;
  };

  useEffect(() => {
    const isPublicRecipeDetail = Boolean(recipeId);
    const seoTitle = isLoading
      ? "Loading recipe | Recipe AI"
      : recipeData?.name
        ? `${recipeData.name} | Recipe AI`
        : isPublicRecipeDetail
          ? "Recipe details | Recipe AI"
          : "Recipe generator | Recipe AI";
    const seoDescription = recipeData?.description?.trim()
      ? recipeData.description.trim()
      : isPublicRecipeDetail
        ? "Open a public recipe on Recipe AI to view ingredients, steps, and cooking time."
        : "Generate a recipe from your ingredients, then save it or try a different variation.";

    applySeo({
      title: seoTitle,
      description: seoDescription,
      canonicalPath: location.pathname,
      noindex: !isPublicRecipeDetail,
    });
  }, [isLoading, location.pathname, recipeData, recipeId]);

  useEffect(() => {
    const loadRecipe = async () => {
      if (existingRecipe) {
        setRecipeOptions([]);
        setSelectedRecipeIndex(0);
        setSaveStatus("idle");
        setRecipeData(existingRecipe);
        setIsLoading(false);
        setError("");
        return;
      }

      if (recipeId) {
        if (currentRecipeIdentifierRef.current !== recipeId) {
          try {
            setIsLoading(true);
            setError("");
            const response = await apiClient(`getRecipe/${recipeId}`, false);
            const normalizedRecipe = normalizeGeneratedRecipes(response)[0];
            if (!normalizedRecipe) {
              throw new Error("Failed to load recipe.");
            }
            setRecipeOptions([]);
            setSelectedRecipeIndex(0);
            setSaveStatus("idle");
            setRecipeData(normalizedRecipe);
            currentRecipeIdentifierRef.current = recipeId;
          } catch (err: unknown) {
            console.error("Error fetching recipe:", err);
            setError("Failed to load recipe. Please try again.");
            currentRecipeIdentifierRef.current = null;
          } finally {
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
        return;
      }

      if (search) {
        if (!fridgeLoading) {
          if (currentRecipeIdentifierRef.current !== search) {
            try {
              setIsLoading(true);
              setError("");
              const fridgeIngredients = getFridgeItemNames();
              abortControllerRef.current?.abort();
              const controller = new AbortController();
              abortControllerRef.current = controller;
              let timedOut = false;
              const timeoutId = window.setTimeout(() => {
                timedOut = true;
                controller.abort();
              }, RECIPE_GENERATION_TIMEOUT_MS);

              let response: unknown;
              try {
                response = await generateRecipe(
                  search,
                  fridgeIngredients,
                  controller.signal,
                  GENERATED_RECIPES_REQUEST_COUNT,
                );
              } catch (generationError: unknown) {
                if (isAbortError(generationError) && timedOut) {
                  throw new Error(
                    `Recipe generation timed out after ${Math.floor(RECIPE_GENERATION_TIMEOUT_MS / 1000)} seconds. Please retry.`,
                  );
                }
                throw generationError;
              } finally {
                window.clearTimeout(timeoutId);
              }

              applyGeneratedRecipeResponse(response, search);
              setIsLoading(false);
            } catch (err: unknown) {
              if (isAbortError(err)) return; // new request owns loading state
              console.error("Error generating recipe:", err);
              setError(resolveGenerationErrorMessage(err));
              setRecipeOptions([]);
              currentRecipeIdentifierRef.current = null;
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        }
        return;
      }

      if (!fridgeLoading) {
        setError("No search term or recipe ID provided");
        setIsLoading(false);
        setRecipeData(null);
        setRecipeOptions([]);
        currentRecipeIdentifierRef.current = null;
      }
    };

    loadRecipe();
  }, [
    search,
    fridgeLoading,
    existingRecipe,
    recipeId,
    applyGeneratedRecipeResponse,
    getFridgeItemNames,
    generationRetryKey,
  ]);

  const handleRetryGeneration = () => {
    currentRecipeIdentifierRef.current = null;
    setError("");
    setRecipeData(null);
    setRecipeOptions([]);
    setIsLoading(true);
    setGenerationRetryKey((previous) => previous + 1);
  };

  const handleSelectRecipe = (index: number) => {
    if (index < 0 || index >= recipeOptions.length) {
      return;
    }

    setSelectedRecipeIndex(index);
    setRecipeData(recipeOptions[index]);
    setSaveStatus("idle");
    setError("");
  };

  const saveRecipe = async () => {
    if (
      !recipeData?.name ||
      !recipeData?.ingredients?.length ||
      !recipeData?.instructions?.length
    ) {
      setError("Recipe data is incomplete and cannot be saved.");
      return;
    }
    try {
      setSaveStatus("saving");
      setError("");
      await apiClient("addRecipe", true, {
        name: recipeData.name,
        description: recipeData.description,
        timeToPrepare: recipeData.timeToPrepare,
        ingredients: recipeData.ingredients,
        instructions: recipeData.instructions,
      });
      setSaveStatus("saved");
    } catch (error: unknown) {
      setSaveStatus("error");
      const status = getErrorStatus(error);
      if (status === 401) {
        setError("You must be logged in to save a recipe.");
      } else if (status === 409) {
        setError("This recipe is already saved in your collection.");
      } else if (status === 403) {
        setError(
          "You reached your current recipe limit. Remove one saved recipe or switch to a paid plan.",
        );
      } else {
        setError(
          getErrorMessage(error, "Failed to save recipe. Please try again."),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateShoppingList = () => {
    if (!recipeData?.ingredients?.length) {
      setError("No ingredients available to generate shopping list.");
      return;
    }

    const missingIngredients = getMissingIngredients(
      recipeData.ingredients,
      fridgeItems,
    );

    const sourceIngredients =
      missingIngredients.length > 0
        ? missingIngredients
        : recipeData.ingredients;

    const updated = addShoppingItems(
      sourceIngredients.map((ingredient) => ({
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
      })),
    );

    if (updated.length === 0) {
      setError("Could not add items to the shopping list. Please try again.");
      return;
    }

    navigate("/ShoppingList");
  };

  const handleDelete = async () => {
    if (!recipeId) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    try {
      setIsLoading(true);
      await deleteClient(`deleteRecipe/${recipeId}`);
      navigate("/Recipes");
    } catch (err: unknown) {
      console.error("Error deleting recipe:", err);
      setError(getErrorMessage(err, "Failed to delete recipe."));
    } finally {
      setIsLoading(false);
      setConfirmDelete(false);
    }
  };

  useEffect(() => {
    if (!confirmDelete) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setConfirmDelete(false);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [confirmDelete]);

  if (isLoading) {
    const isGeneratingRecipe = Boolean(search) && !recipeId && !existingRecipe;

    return (
      <FoodLoadingScreen
        title={
          isGeneratingRecipe ? "Generating your recipe..." : "Loading recipe..."
        }
        subtitle={
          isGeneratingRecipe
            ? "Mixing ingredients, matching flavors, and adding a spicy twist"
            : "Preparing your delicious recipe"
        }
        variant={isGeneratingRecipe ? "generating" : "default"}
      />
    );
  }

  if (!recipeData) {
    const canRetryGeneration = Boolean(search) && !recipeId && !existingRecipe;

    return (
      <div className="flex h-screen items-center justify-center bg-background px-4">
        <div className="rounded-2xl border border-primary/15 bg-secondary px-6 py-8 text-center shadow-sm">
          <div className="text-xl font-semibold text-text">
            No recipe data available
          </div>
          <p className="mt-1 text-sm text-text/60">
            {error || "Try generating a new recipe from the homepage."}
          </p>

          {canRetryGeneration && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={handleRetryGeneration}
                className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-text transition-colors hover:bg-accent/90"
              >
                Retry Generation
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded-lg border border-primary/20 bg-background px-4 py-2.5 font-semibold text-text transition-colors hover:border-accent/50"
              >
                Back to Home
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const ingredientCount = recipeData.ingredients?.length ?? 0;
  const instructionCount = recipeData.instructions?.length ?? 0;

  return (
    <div className="mobile-page-enter min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorAlert
          message={error}
          className="mb-5"
          onAutoHide={() => setError("")}
        />

        <section className="mobile-card-enter relative overflow-hidden rounded-3xl border border-accent/35 bg-secondary p-6 sm:p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />

          <div className="relative">
            <p className="mb-2 inline-flex rounded-full border border-primary/15 bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text/60">
              AI Kitchen Recipe
            </p>
            <h1 className="text-3xl font-bold leading-tight text-text sm:text-4xl">
              {recipeData.name}
            </h1>

            {recipeData.description && (
              <p className="mt-3 max-w-3xl text-base text-text/75 sm:text-lg">
                {recipeData.description}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {recipeData.timeToPrepare && (
                <span className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-text">
                  {recipeData.timeToPrepare}
                </span>
              )}
              <span className="rounded-full border border-primary/15 bg-background px-3 py-1.5 text-sm text-text/75">
                {ingredientCount} ingredients
              </span>
              <span className="rounded-full border border-primary/15 bg-background px-3 py-1.5 text-sm text-text/75">
                {instructionCount} steps
              </span>
            </div>
          </div>
        </section>

        {!recipeId && recipeOptions.length > 1 && (
          <section className="mobile-card-enter mobile-card-delay-1 mt-6 rounded-2xl border border-primary/10 bg-secondary p-5">
            <h3 className="text-lg font-semibold text-text">
              Choose One Of {recipeOptions.length} Different Recipes
            </h3>
            <p className="mt-1 text-sm text-text/60">
              Generated in one request with intentionally different cuisine,
              technique, and core ingredients.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {recipeOptions.map((option, index) => (
                <button
                  key={`${option.name}-${index}`}
                  onClick={() => handleSelectRecipe(index)}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    selectedRecipeIndex === index
                      ? "border-accent bg-accent/15"
                      : "border-primary/15 bg-background hover:border-accent/45"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-text/60">
                    Option {index + 1}
                  </p>
                  <p className="mt-1 line-clamp-2 font-semibold text-text">
                    {option.name}
                  </p>
                  <p className="mt-1 text-xs text-text/60">
                    {option.ingredients.length} ingredients
                    {option.timeToPrepare ? ` • ${option.timeToPrepare}` : ""}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {recipeData.nutrition && (
          <div className="mobile-card-enter mobile-card-delay-1 mt-6 rounded-2xl border border-accent/30 bg-secondary p-5">
            <h3 className="mb-4 text-lg font-semibold text-text">
              Nutrition (estimated)
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-accent/20 bg-background px-3 py-2.5 text-sm text-text">
                <span className="block text-text/60">Calories</span>
                <span className="font-semibold">
                  {formatMacro(recipeData.nutrition.calories, " kcal")}
                </span>
              </div>
              <div className="rounded-xl border border-accent/20 bg-background px-3 py-2.5 text-sm text-text">
                <span className="block text-text/60">Protein</span>
                <span className="font-semibold">
                  {formatMacro(recipeData.nutrition.protein, " g")}
                </span>
              </div>
              <div className="rounded-xl border border-accent/20 bg-background px-3 py-2.5 text-sm text-text">
                <span className="block text-text/60">Carbs</span>
                <span className="font-semibold">
                  {formatMacro(recipeData.nutrition.carbs, " g")}
                </span>
              </div>
              <div className="rounded-xl border border-accent/20 bg-background px-3 py-2.5 text-sm text-text">
                <span className="block text-text/60">Fats</span>
                <span className="font-semibold">
                  {formatMacro(recipeData.nutrition.fats, " g")}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mobile-card-enter mobile-card-delay-1 h-full rounded-2xl border border-primary/10 bg-secondary p-6">
              <h2 className="mb-4 text-2xl font-semibold text-text">
                Ingredients
              </h2>
              <ul className="space-y-2.5">
                {(recipeData.ingredients || []).map((ingredient, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-primary/10 bg-background px-3 py-2 text-text"
                  >
                    <span className="font-medium">{ingredient.name}</span>
                    <span className="text-sm text-text/75">
                      {ingredient.amount} {ingredient.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <div className="mobile-card-enter mobile-card-delay-2 h-full rounded-2xl border border-primary/10 bg-secondary p-6">
              <h2 className="mb-4 text-2xl font-semibold text-text">
                Instructions
              </h2>
              <ol className="space-y-4">
                {(recipeData.instructions || []).map((instruction, index) => (
                  <li
                    key={index}
                    className="group flex items-start gap-3.5 rounded-2xl border border-primary/12 bg-background/95 px-4 py-4 text-text shadow-[0_10px_28px_-22px_rgba(17,17,17,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/55 hover:shadow-[0_16px_34px_-24px_rgba(17,17,17,0.9)] sm:px-5"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-base font-extrabold text-primary ring-2 ring-accent/35 ring-offset-2 ring-offset-background shadow-[0_3px_0_rgba(0,0,0,0.08)]">
                      {index + 1}
                    </span>
                    <span className="pt-0.5 text-[1.03rem] font-medium leading-8 text-text/90">
                      {instruction}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <div className="mobile-card-enter mobile-card-delay-2 mt-8 rounded-2xl border border-primary/10 bg-secondary p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="mobile-soft-press inline-flex w-full items-center justify-center rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-black transition-colors hover:bg-yellow-300"
              onClick={handleGenerateShoppingList}
            >
              Generate Shopping List
            </button>

            {!recipeId && user && (
              <button
                className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 font-semibold transition-colors ${
                  saveStatus === "saved"
                    ? "cursor-default bg-green-600 text-white"
                    : saveStatus === "saving"
                      ? "cursor-wait bg-accent/60 text-text"
                      : "mobile-soft-press bg-accent text-text hover:bg-accent/90"
                }`}
                onClick={() => saveRecipe()}
                disabled={saveStatus === "saving" || saveStatus === "saved"}
              >
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                    ? "Saved ✓"
                    : "Save Recipe"}
              </button>
            )}

            {recipeId && user && (
              <button
                className="mobile-soft-press inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 font-semibold text-white transition-colors hover:bg-black/90"
                onClick={handleDelete}
              >
                {confirmDelete
                  ? "Click Again to Confirm Delete"
                  : "Delete Recipe"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipePage;
