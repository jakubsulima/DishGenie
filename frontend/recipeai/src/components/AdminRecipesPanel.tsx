import React, { useEffect, useState, useContext, useCallback } from "react";
import { AuthContext } from "../context/context";
import { apiClient, deleteClient } from "../lib/hooks";
import { TableSkeleton } from "./Skeleton";
import ErrorAlert from "./ErrorAlert";

interface Recipe {
  id: number;
  name: string;
  timeToPrepare: string;
}

const AdminRecipesPanel: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const PAGE_SIZE = 20;
  const authContext = useContext(AuthContext);

  const fetchRecipes = useCallback(
    async (pageNum = page) => {
      setLoading(true);
      try {
        const data = await apiClient(
          `getAllRecipes?page=${pageNum}&size=${PAGE_SIZE}`,
        );
        const pagedData =
          data && typeof data === "object"
            ? (data as { content?: Recipe[]; totalPages?: number })
            : undefined;
        setRecipes(Array.isArray(pagedData?.content) ? pagedData.content : []);
        setTotalPages(
          typeof pagedData?.totalPages === "number" ? pagedData.totalPages : 0,
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
    },
    [page],
  );

  useEffect(() => {
    if (authContext?.user?.role === "ADMIN") {
      fetchRecipes(page);
    }
  }, [authContext?.user?.role, page, fetchRecipes]);

  const handleDeleteRecipe = async (recipeId: number) => {
    if (window.confirm("Are you sure you want to delete this recipe?")) {
      try {
        await deleteClient(`admin/deleteRecipe/${recipeId}`);
        fetchRecipes(page);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred while deleting recipe",
        );
        console.error(err);
      }
    }
  };

  if (authContext?.loading) {
    return null;
  }

  if (!authContext || authContext.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Recipe Management</h2>
      <ErrorAlert
        message={error}
        className="mb-4"
        compact
        onAutoHide={() => setError(null)}
      />
      {loading ? (
        <TableSkeleton rows={PAGE_SIZE} columns={4} />
      ) : recipes.length === 0 && !error ? (
        <p className="text-text/70">No recipes found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full overflow-hidden rounded-lg bg-secondary shadow-md">
            <thead className="bg-primary/10 text-text">
              <tr>
                <th className="py-3 px-4 text-left">ID</th>
                <th className="py-3 px-4 text-left">Title</th>
                <th className="py-3 px-4 text-left">Time to Prepare</th>
                <th className="py-3 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="text-text">
              {recipes.map((recipe) => (
                <tr
                  key={recipe.id}
                  className="border-b border-primary/20 transition-colors hover:bg-primary/5"
                >
                  <td className="py-3 px-4">{recipe.id}</td>
                  <td className="py-3 px-4">{recipe.name}</td>
                  <td className="py-3 px-4">{recipe.timeToPrepare}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDeleteRecipe(recipe.id)}
                      className="mobile-soft-press rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-accent/85 focus:outline-none"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="mobile-soft-press rounded-full bg-secondary px-4 py-2 text-sm font-medium text-text transition-all duration-300 hover:bg-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-secondary"
          >
            Previous
          </button>
          <span className="text-text text-sm">
            Page {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="mobile-soft-press rounded-full bg-secondary px-4 py-2 text-sm font-medium text-text transition-all duration-300 hover:bg-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-secondary"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminRecipesPanel;
