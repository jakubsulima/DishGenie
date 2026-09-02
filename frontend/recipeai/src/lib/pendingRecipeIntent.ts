const PENDING_RECIPE_SEARCH_KEY = "dishGeniePendingRecipeSearch";

export const savePendingRecipeSearch = (search: string, generationOptions?: unknown) => {
  if (!search.trim()) {
    return;
  }

  sessionStorage.setItem(
    PENDING_RECIPE_SEARCH_KEY,
    JSON.stringify({ search, generationOptions }),
  );
};

const parsePendingValue = (value: string | null) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { search?: unknown; generationOptions?: unknown };
    if (typeof parsed.search === "string" && parsed.search.trim()) {
      return parsed;
    }
  } catch {
    // Values written by older releases were plain search strings.
  }
  return { search: value };
};

export const consumePendingRecipeRedirect = () => {
  const pending = parsePendingValue(sessionStorage.getItem(PENDING_RECIPE_SEARCH_KEY));
  if (!pending) {
    return null;
  }

  sessionStorage.removeItem(PENDING_RECIPE_SEARCH_KEY);
  return {
    pathname: "/Recipe",
    search: "",
    state: { search: pending.search, generationOptions: pending.generationOptions },
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

  const pending = parsePendingValue(sessionStorage.getItem(PENDING_RECIPE_SEARCH_KEY));
  return typeof pending?.search === "string" ? pending.search : null;
};

export const clearPendingRecipeSearch = () => {
  sessionStorage.removeItem(PENDING_RECIPE_SEARCH_KEY);
};
