const PENDING_RECIPE_SEARCH_KEY = "dishGeniePendingRecipeSearch";

export const savePendingRecipeSearch = (search: string) => {
  if (!search.trim()) {
    return;
  }

  sessionStorage.setItem(PENDING_RECIPE_SEARCH_KEY, search);
};

export const consumePendingRecipeRedirect = () => {
  const search = sessionStorage.getItem(PENDING_RECIPE_SEARCH_KEY);
  if (!search) {
    return null;
  }

  sessionStorage.removeItem(PENDING_RECIPE_SEARCH_KEY);
  return {
    pathname: "/Recipe",
    search: "",
    state: { search },
  };
};

export const readPendingRecipeSearch = (authState?: unknown) => {
  if (authState && typeof authState === "object") {
    const from = (authState as { from?: unknown }).from;
    if (from && typeof from === "object") {
      const state = (from as { state?: unknown }).state;
      if (state && typeof state === "object") {
        const search = (state as { search?: unknown }).search;
        if (typeof search === "string" && search.trim() !== "") {
          return search;
        }
      }
    }
  }

  return sessionStorage.getItem(PENDING_RECIPE_SEARCH_KEY);
};

export const clearPendingRecipeSearch = () => {
  sessionStorage.removeItem(PENDING_RECIPE_SEARCH_KEY);
};
