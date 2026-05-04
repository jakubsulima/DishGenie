interface RecipeAiRuntimeConfig {
  googleClientId?: string;
}

interface RecipeAiWindow extends Window {
  __RECIPE_AI_RUNTIME_CONFIG__?: RecipeAiRuntimeConfig;
}

const getRuntimeConfig = (): RecipeAiRuntimeConfig => {
  const globalWindow = window as RecipeAiWindow;
  return globalWindow.__RECIPE_AI_RUNTIME_CONFIG__ ?? {};
};

export const getGoogleClientId = (): string =>
  getRuntimeConfig().googleClientId?.trim() || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";