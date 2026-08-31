import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
import { AuthContext } from "../context/context";
import { apiClient, deleteClient, putClient } from "../lib/hooks";
import { TableSkeleton } from "./Skeleton";
import ErrorAlert from "./ErrorAlert";
import PaginationControls from "./PaginationControls";
import type { PageResponse, UserRecipeFilter } from "../lib/adminTypes";
import { useLanguage } from "../context/languageContext";

interface RecipeIngredient {
  name: string;
  amount: number;
  unit?: string;
}

interface RecipeNutrition {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fats?: number | null;
}

interface Recipe {
  id: number;
  name: string;
  description?: string;
  timeToPrepare?: string;
  ingredients?: RecipeIngredient[];
  instructions?: string[];
  nutrition?: RecipeNutrition | null;
  servings?: number;
}

interface AdminRecipesPanelProps {
  userFilter?: UserRecipeFilter | null;
  onClearUserFilter?: () => void;
}

const PAGE_SIZE = 20;

const AdminRecipesPanel: React.FC<AdminRecipesPanelProps> = ({
  userFilter = null,
  onClearUserFilter,
}) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecipes, setTotalRecipes] = useState<number>(0);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const authContext = useContext(AuthContext);
  const { t } = useLanguage();

  const endpoint = useMemo(() => {
    const pageQuery = `page=${page}&size=${PAGE_SIZE}`;
    if (userFilter) {
      return `getUserRecipes/${userFilter.id}?${pageQuery}`;
    }
    const trimmedSearch = appliedSearch.trim();
    if (trimmedSearch) {
      return `searchRecipes/${encodeURIComponent(trimmedSearch)}?${pageQuery}`;
    }
    return `getAllRecipes?${pageQuery}`;
  }, [appliedSearch, page, userFilter]);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient<PageResponse<Recipe>>(endpoint);
      setRecipes(Array.isArray(data.content) ? data.content : []);
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 1);
      setTotalRecipes(
        typeof data.totalElements === "number" ? data.totalElements : 0,
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while fetching recipes",
      );
      console.error(err);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (authContext?.user?.role === "ADMIN") {
      fetchRecipes();
    }
  }, [authContext?.user?.role, fetchRecipes]);

  useEffect(() => {
    setPage(0);
    setSelectedRecipe(null);
    setEditingRecipe(null);
  }, [userFilter?.id]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(0);
    setSelectedRecipe(null);
    setEditingRecipe(null);
    setAppliedSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setPage(0);
    setSelectedRecipe(null);
    setEditingRecipe(null);
    setSearchInput("");
    setAppliedSearch("");
  };

  const loadRecipeDetails = async (recipeId: number) => {
    setError(null);
    try {
      const recipe = await apiClient<Recipe>(`getRecipe/${recipeId}`);
      setSelectedRecipe(recipe);
      setEditingRecipe(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while loading recipe details",
      );
      console.error(err);
    }
  };

  const handleDeleteRecipe = async (recipe: Recipe) => {
    if (!window.confirm(t('Delete recipe "{name}"?', { name: recipe.name }))) {
      return;
    }

    setError(null);
    try {
      await deleteClient(`admin/deleteRecipe/${recipe.id}`);
      if (selectedRecipe?.id === recipe.id) {
        setSelectedRecipe(null);
      }
      if (editingRecipe?.id === recipe.id) {
        setEditingRecipe(null);
      }
      await fetchRecipes();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while deleting recipe",
      );
      console.error(err);
    }
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRecipe) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const nextRecipe: Recipe = {
      ...editingRecipe,
      name: String(form.get("name") || "").trim(),
      description: String(form.get("description") || "").trim(),
      timeToPrepare: String(form.get("timeToPrepare") || "").trim(),
      ingredients: parseIngredients(String(form.get("ingredients") || "")),
      instructions: parseInstructions(String(form.get("instructions") || "")),
      servings: editingRecipe.servings || 2,
    };

    if (!nextRecipe.name) {
      setError(t("Recipe name is required."));
      return;
    }

    if (!nextRecipe.ingredients || nextRecipe.ingredients.length === 0) {
      setError(t("At least one ingredient is required."));
      return;
    }

    setSavingRecipe(true);
    setError(null);
    try {
      const updatedRecipe = (await putClient(
        `admin/recipes/${editingRecipe.id}`,
        nextRecipe,
      )) as Recipe;
      setSelectedRecipe(updatedRecipe);
      setEditingRecipe(null);
      await fetchRecipes();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while updating recipe",
      );
      console.error(err);
    } finally {
      setSavingRecipe(false);
    }
  };

  if (authContext?.loading) {
    return null;
  }

  if (!authContext || authContext.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t("Recipe Management")}</h2>
          <p className="mt-1 text-sm text-text/70">
            {t("Search, inspect, edit, or remove recipes. Fridge and shopping list data stay outside this admin view.")}
          </p>
        </div>
        <div className="text-sm text-text/70">
          {t("{count} recipes in this view", { count: totalRecipes })}
        </div>
      </div>

      <ErrorAlert
        message={error ? t(error) : null}
        className="mb-4"
        compact
        onAutoHide={() => setError(null)}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="min-h-10 rounded border border-primary/30 bg-secondary px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent sm:w-80"
            placeholder={t("Search recipes by name or ingredient")}
            aria-label={t("Search recipes by name or ingredient")}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="mobile-soft-press rounded bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent/80"
            >
              {t("Search")}
            </button>
            {(appliedSearch || searchInput) && (
              <button
                type="button"
                onClick={clearSearch}
                className="mobile-soft-press rounded bg-secondary px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-primary/10"
              >
                {t("Clear")}
              </button>
            )}
          </div>
        </form>

        {userFilter && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded bg-primary/10 px-3 py-2 text-text">
              {t("Showing recipes for {email}", { email: userFilter.email })}
            </span>
            <button
              type="button"
              onClick={onClearUserFilter}
              className="mobile-soft-press rounded bg-secondary px-3 py-2 font-semibold text-text transition-colors hover:bg-primary/10"
            >
              {t("Show all")}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={PAGE_SIZE} columns={5} />
      ) : recipes.length === 0 && !error ? (
        <p className="text-text/70">{t("No recipes found.")}</p>
      ) : (
        <div className="overflow-x-auto rounded border border-primary/20">
          <table className="min-w-full bg-secondary">
            <thead className="bg-primary/10 text-sm text-text">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">{t("Title")}</th>
                <th className="px-4 py-3 text-left">{t("Time")}</th>
                <th className="px-4 py-3 text-left">{t("Contents")}</th>
                <th className="px-4 py-3 text-left">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="text-sm text-text">
              {recipes.map((recipe) => (
                <tr
                  key={recipe.id}
                  className="border-t border-primary/15 align-top transition-colors hover:bg-primary/5"
                >
                  <td className="px-4 py-3">{recipe.id}</td>
                  <td className="px-4 py-3 font-medium">{recipe.name}</td>
                  <td className="px-4 py-3">
                    {recipe.timeToPrepare || t("Not set")}
                  </td>
                  <td className="px-4 py-3 text-text/70">
                    {(recipe.ingredients?.length || 0) > 0
                      ? t("{count} ingredients", { count: recipe.ingredients?.length || 0 })
                      : t("Open details")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadRecipeDetails(recipe.id)}
                        className="mobile-soft-press rounded bg-background px-3 py-2 text-sm font-semibold text-text transition-colors hover:bg-primary/10"
                      >
                        {t("View")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRecipe(recipe);
                          setSelectedRecipe(recipe);
                        }}
                        className="mobile-soft-press rounded bg-background px-3 py-2 text-sm font-semibold text-text transition-colors hover:bg-primary/10"
                      >
                        {t("Edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRecipe(recipe)}
                        className="mobile-soft-press rounded bg-accent px-3 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent/80"
                      >
                        {t("Delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {(selectedRecipe || editingRecipe) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {selectedRecipe && (
            <RecipeDetails
              recipe={selectedRecipe}
              onEdit={() => setEditingRecipe(selectedRecipe)}
            />
          )}
          {editingRecipe && (
            <RecipeEditor
              recipe={editingRecipe}
              saving={savingRecipe}
              onCancel={() => setEditingRecipe(null)}
              onSubmit={handleEditSubmit}
            />
          )}
        </div>
      )}
    </section>
  );
};

const RecipeDetails = ({
  recipe,
  onEdit,
}: {
  recipe: Recipe;
  onEdit: () => void;
}) => {
  const { t } = useLanguage();
  return (
  <div className="rounded border border-primary/20 bg-secondary p-4">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-xl font-semibold">{recipe.name}</h3>
        <p className="mt-1 text-sm text-text/70">
          ID {recipe.id} · {recipe.timeToPrepare || t("No time set")}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mobile-soft-press rounded bg-background px-3 py-2 text-sm font-semibold text-text transition-colors hover:bg-primary/10"
      >
        {t("Edit")}
      </button>
    </div>

    {recipe.description && (
      <p className="mb-4 text-sm leading-6 text-text/80">{recipe.description}</p>
    )}

    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h4 className="mb-2 font-semibold">{t("Ingredients")}</h4>
        <ul className="space-y-1 text-sm text-text/75">
          {(recipe.ingredients || []).map((ingredient, index) => (
            <li key={`${ingredient.name}-${index}`}>
              {ingredient.name} · {ingredient.amount} {ingredient.unit || ""}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="mb-2 font-semibold">{t("Instructions")}</h4>
        <ol className="space-y-1 text-sm text-text/75">
          {(recipe.instructions || []).map((instruction, index) => (
            <li key={`${instruction}-${index}`}>
              {index + 1}. {instruction}
            </li>
          ))}
        </ol>
      </div>
    </div>
  </div>
  );
};

const RecipeEditor = ({
  recipe,
  saving,
  onCancel,
  onSubmit,
}: {
  recipe: Recipe;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const { t } = useLanguage();
  return (
  <form
    onSubmit={onSubmit}
    className="rounded border border-primary/20 bg-secondary p-4"
  >
    <h3 className="mb-4 text-xl font-semibold">{t("Edit Recipe")}</h3>
    <div className="grid gap-3">
      <label className="text-sm font-semibold">
        {t("Name")}
        <input
          name="name"
          defaultValue={recipe.name}
          className="mt-1 min-h-10 w-full rounded border border-primary/30 bg-background px-3 text-sm font-normal text-text focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
      <label className="text-sm font-semibold">
        {t("Time to prepare")}
        <input
          name="timeToPrepare"
          defaultValue={recipe.timeToPrepare || ""}
          className="mt-1 min-h-10 w-full rounded border border-primary/30 bg-background px-3 text-sm font-normal text-text focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
      <label className="text-sm font-semibold">
        {t("Description")}
        <textarea
          name="description"
          defaultValue={recipe.description || ""}
          rows={3}
          className="mt-1 w-full rounded border border-primary/30 bg-background px-3 py-2 text-sm font-normal text-text focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
      <label className="text-sm font-semibold">
        {t("Ingredients")}
        <textarea
          name="ingredients"
          defaultValue={formatIngredients(recipe.ingredients || [])}
          rows={6}
          className="mt-1 w-full rounded border border-primary/30 bg-background px-3 py-2 font-mono text-sm font-normal text-text focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
      <label className="text-sm font-semibold">
        {t("Instructions")}
        <textarea
          name="instructions"
          defaultValue={(recipe.instructions || []).join("\n")}
          rows={6}
          className="mt-1 w-full rounded border border-primary/30 bg-background px-3 py-2 text-sm font-normal text-text focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="submit"
        disabled={saving}
        className="mobile-soft-press rounded bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t(saving ? "Saving" : "Save")}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="mobile-soft-press rounded bg-background px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-primary/10"
      >
        {t("Cancel")}
      </button>
    </div>
  </form>
  );
};

const formatIngredients = (ingredients: RecipeIngredient[]) =>
  ingredients
    .map(
      (ingredient) =>
        `${ingredient.name} | ${ingredient.amount} | ${ingredient.unit || ""}`,
    )
    .join("\n");

const parseIngredients = (value: string): RecipeIngredient[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", amount = "1", unit = ""] = line
        .split("|")
        .map((part) => part.trim());
      const parsedAmount = Number(amount);
      return {
        name,
        amount:
          Number.isFinite(parsedAmount) && parsedAmount > 0
            ? parsedAmount
            : 1,
        unit,
      };
    })
    .filter((ingredient) => ingredient.name);

const parseInstructions = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export default AdminRecipesPanel;
