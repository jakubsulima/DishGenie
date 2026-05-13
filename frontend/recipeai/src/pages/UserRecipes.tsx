import { useState, useEffect, useCallback } from "react";
import { RecipeData } from "./RecipePage";
import { apiClient } from "../lib/hooks";
import { useUser } from "../context/context";
import RecipeContainer from "../components/RecipeContainer";
import PaginationControls from "../components/PaginationControls";
import { RecipesPageSkeleton } from "../components/Skeleton";
import ErrorAlert from "../components/ErrorAlert";
import { Link } from "react-router-dom";

interface PagedRecipesResponse {
  content: RecipeData[];
  totalPages: number;
}

const Recipes = () => {
  const [recipes, setRecipes] = useState<RecipeData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const { user, loading: userLoading } = useUser();
  const [error, setError] = useState<string>("");
  const [draftSearchTerm, setDraftSearchTerm] = useState<string>("");
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState<string>("");

  const RECIPES_PER_PAGE = 9;
  const GUEST_RECIPES_LIMIT = 10;
  const isGuest = !user;
  const isSearching = submittedSearchTerm.trim().length > 0;

  const fetchAllRecipes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const endpoint = isGuest
        ? `getAllRecipes?page=0&size=${GUEST_RECIPES_LIMIT}&sort=id,desc`
        : `getAllRecipes?page=${currentPage}&size=${RECIPES_PER_PAGE}`;
      const response = await apiClient<Partial<PagedRecipesResponse>>(
        endpoint,
        false,
      );
      const paged = response;
      setRecipes(Array.isArray(paged?.content) ? paged.content : []);
      setTotalPages(
        typeof paged?.totalPages === "number" ? paged.totalPages : 1,
      );
    } catch (error) {
      setError("Error fetching recipes");
      console.error("Error fetching recipes:", error);
    } finally {
      setIsLoading(false);
    }
  }, [GUEST_RECIPES_LIMIT, RECIPES_PER_PAGE, currentPage, isGuest]);

  const searchRecipes = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const response = await apiClient<Partial<PagedRecipesResponse>>(
          `searchRecipes/${encodeURIComponent(
            term,
          )}?page=${currentPage}&size=${RECIPES_PER_PAGE}`,
          false,
        );
        const paged =
          response && typeof response === "object"
            ? (response as { content?: RecipeData[]; totalPages?: number })
            : undefined;
        setRecipes(Array.isArray(paged?.content) ? paged.content : []);
        setTotalPages(
          typeof paged?.totalPages === "number" ? paged.totalPages : 1,
        );
      } catch (error) {
        setError("Error searching recipes");
        console.error("Error searching recipes:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [RECIPES_PER_PAGE, currentPage],
  );

  const handleSearch = () => {
    if (isGuest) {
      return;
    }

    const trimmedTerm = draftSearchTerm.trim();
    setCurrentPage(0);
    setSubmittedSearchTerm(trimmedTerm);
  };

  const handleClearSearch = () => {
    setDraftSearchTerm("");
    setSubmittedSearchTerm("");
    setCurrentPage(0);
  };

  useEffect(() => {
    const fetchUserRecipes = async () => {
      if (userLoading) {
        return;
      }

      // If searching, use search endpoint
      if (isSearching) {
        searchRecipes(submittedSearchTerm);
        return;
      }

      if (user && user.id) {
        try {
          setIsLoading(true);
          setError("");
          const response = await apiClient<PagedRecipesResponse>(
            `getUserRecipes/${user.id}?page=${currentPage}&size=${RECIPES_PER_PAGE}`,
            false,
          );
          setRecipes(response.content);
          setTotalPages(response.totalPages);
        } catch (error) {
          setError("Error fetching recipes");
          console.error("Error fetching recipes:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        fetchAllRecipes();
      }
    };
    fetchUserRecipes();
  }, [
    user,
    userLoading,
    currentPage,
    isSearching,
    submittedSearchTerm,
    fetchAllRecipes,
    searchRecipes,
  ]);

  if (userLoading || isLoading) {
    return (
      <RecipesPageSkeleton
        showSearch={Boolean(user)}
        showGuestBanner={!userLoading && !user}
      />
    );
  }

  return (
    <>
      <section className="mobile-page-enter flex flex-col max-w-4xl mx-auto w-full bg-background min-h-screen p-4 md:p-6">
        <article className="flex-1">
          {/* Header with decorative elements */}
          <div className="ambient-gradient-card mb-6 rounded-3xl border border-accent/35 bg-secondary p-6 text-center md:mb-8 sm:p-8">
            <div>
              <div className="flex items-center justify-center gap-3 mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 md:h-10 md:w-10 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <h1 className="text-3xl md:text-4xl font-bold text-text tracking-tight">
                  {user ? "My Recipes" : "Latest Recipes"}
                </h1>
              </div>
              <p className="text-text/60 text-xs md:text-sm">
                {user
                  ? "Your personal recipe collection"
                  : "Discover 10 newest community recipes and unlock full features after login"}
              </p>
            </div>
          </div>

          {/* Search Bar */}
          {user && (
            <div className="mb-6">
              <div className="relative max-w-2xl mx-auto">
                <div className="flex items-center rounded-full border border-primary/20 bg-secondary focus-within:ring-2 focus-within:ring-accent transition-all">
                  <input
                    type="text"
                    value={draftSearchTerm}
                    onChange={(e) => setDraftSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSearch();
                      }
                    }}
                    placeholder="Search recipes by name..."
                    className="flex-1 min-w-0 px-4 py-3 bg-transparent text-text focus:outline-none placeholder:text-text/50"
                  />
                  {draftSearchTerm && (
                    <button
                      onClick={handleClearSearch}
                      className="shrink-0 px-2 text-text/70 hover:text-accent focus:outline-none transition-colors"
                      aria-label="Clear search"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                  <div className="w-px h-6 bg-primary/20 mx-1 shrink-0" />
                  <button
                    onClick={handleSearch}
                    className="mobile-soft-press shrink-0 bg-accent hover:bg-accent/90 text-primary px-4 py-2 m-1 rounded-full font-medium transition-colors"
                  >
                    Search
                  </button>
                </div>
                {isSearching && (
                  <div className="mt-2 text-center">
                    <span className="inline-block px-3 py-1 bg-accent/20 rounded-full text-text text-sm">
                      Searching for: "{submittedSearchTerm}"
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {isGuest && (
            <div className="mb-6 rounded-2xl border border-accent/35 bg-secondary p-4 text-center">
              <p className="text-sm text-text/75">
                You are browsing as a guest. Create an account to generate AI
                recipes, save favorites, and unlock your Virtual Fridge.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/login"
                  className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-accent/90"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="rounded-full border border-primary/20 bg-background px-4 py-2 text-sm font-semibold text-text transition-colors hover:text-accent"
                >
                  Sign Up Free
                </Link>
              </div>
            </div>
          )}

          <ErrorAlert
            message={error}
            className="mb-6"
            onAutoHide={() => setError("")}
          />

          {recipes && recipes.length > 0 ? (
            <div className="space-y-3 md:space-y-4">
              {recipes.map((recipe, index) => (
                <div
                  key={recipe.id}
                  className="animate-fadeIn"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <RecipeContainer
                    id={Number(recipe.id)}
                    title={recipe.name}
                    timeToPrepare={recipe.timeToPrepare}
                  />
                </div>
              ))}
            </div>
          ) : (
            !error && (
              <div className="text-center text-text/50 py-12 md:py-16">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-4 text-text/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isSearching ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  )}
                </svg>
                <p className="text-lg md:text-xl font-medium">
                  {isSearching
                    ? `No recipes found for "${submittedSearchTerm}"`
                    : isGuest
                      ? "No public recipes available yet."
                      : "No recipes found."}
                </p>
                <p className="text-sm md:text-base mt-2">
                  {isSearching
                    ? "Try searching with different keywords"
                    : isGuest
                      ? "Sign in to generate your own recipes and start saving favorites."
                      : "Start creating your first recipe!"}
                </p>
                {isSearching && (
                  <button
                    onClick={handleClearSearch}
                    className="mobile-soft-press mt-4 px-4 py-2 bg-secondary hover:bg-accent hover:text-primary rounded-full transition-colors font-medium"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            )
          )}
        </article>
        {user && (
          <article className="pt-4 md:pt-6 pb-2">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </article>
        )}
      </section>
    </>
  );
};

export default Recipes;
