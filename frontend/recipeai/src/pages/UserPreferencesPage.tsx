import { useEffect, useState, useCallback, useMemo } from "react";
import { useUser } from "../context/context";
import { useNavigate, useLocation } from "react-router-dom";
import { apiClient } from "../lib/hooks";
import { PreferencesPageSkeleton } from "../components/Skeleton";
import ErrorAlert from "../components/ErrorAlert";
import ProfileSummaryCard from "../components/userPreferences/ProfileSummaryCard";
import PlanLimitsPanel from "../components/userPreferences/PlanLimitsPanel";
import DietaryPlanPanel from "../components/userPreferences/DietaryPlanPanel";
import DislikedIngredientsPanel from "../components/userPreferences/DislikedIngredientsPanel";
import {
  getDietLabel,
  getDietOptionGroups,
  normalizeDietValue,
} from "../lib/dietOptions";

const NONE_DIET_VALUE = "NONE";

const sanitizeDietSelection = (
  values: string[],
  availableValues: Set<string>,
): string[] => {
  const uniqueNormalized = Array.from(
    new Set(values.map((value) => normalizeDietValue(value)).filter(Boolean)),
  ).filter((value) => availableValues.has(value));

  if (
    uniqueNormalized.includes(NONE_DIET_VALUE) &&
    uniqueNormalized.length > 1
  ) {
    return [NONE_DIET_VALUE];
  }

  return uniqueNormalized;
};

const MePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: userLoading, getUserPreferences, setUser } = useUser();

  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [dietOptions, setDietOptions] = useState<string[]>([]);
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [dietSaving, setDietSaving] = useState<boolean>(false);
  const [newIngredient, setNewIngredient] = useState<string>("");
  const [dislikedIngredientError, setDislikedIngredientError] =
    useState<string>("");
  const [preferencesLoaded, setPreferencesLoaded] = useState<boolean>(false);

  const navigationState = location.state as {
    fromRegistration?: boolean;
  } | null;
  const showRegistrationOnboarding = Boolean(navigationState?.fromRegistration);

  useEffect(() => {
    const fetchDietOptions = async () => {
      try {
        const response: string[] = await apiClient("user/getDiets");
        const normalizedDiets = response
          .map((diet) => normalizeDietValue(diet))
          .filter(
            (diet, index, diets) =>
              diet.length > 0 && diets.indexOf(diet) === index,
          );
        setDietOptions(normalizedDiets);
      } catch (error) {
        console.error("Failed to fetch diet options:", error);
        setError("Failed to load diet options");
      } finally {
        setLoading(false);
      }
    };
    fetchDietOptions();
  }, []);

  const fetchUserPreferences = useCallback(async () => {
    if (!user || userLoading || preferencesLoaded) return;
    try {
      await getUserPreferences();
      setPreferencesLoaded(true);
    } catch (error) {
      setError("Failed to fetch user preferences");
      console.error("Error fetching user preferences:", error);
    }
  }, [user, userLoading, getUserPreferences, preferencesLoaded]);

  useEffect(() => {
    fetchUserPreferences();
  }, [fetchUserPreferences]);

  const handleUpdatePreferences = async (
    updateFn: () => Promise<unknown>,
    successMsg: string,
    errorMessage: string,
  ) => {
    setError("");
    setSuccessMessage("");
    try {
      await updateFn();
      await getUserPreferences();
      setSuccessMessage(successMsg);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setError(errorMessage);
      console.error(errorMessage, error);
    }
  };

  const addDislikedIngredient = () => {
    const normalizedIngredient = newIngredient.trim().toLowerCase();
    if (!normalizedIngredient) {
      setDislikedIngredientError("Enter an ingredient to add.");
      return;
    }

    const currentDisliked = user?.preferences?.dislikedIngredients || [];
    if (
      currentDisliked.some(
        (ingredient) => ingredient.toLowerCase() === normalizedIngredient,
      )
    ) {
      setDislikedIngredientError(
        "This ingredient is already in your disliked list.",
      );
      return;
    }

    setDislikedIngredientError("");
    handleUpdatePreferences(
      () => apiClient("user/addDislikedIngredient", true, normalizedIngredient),
      "Ingredient added",
      "Failed to add disliked ingredient",
    ).then(() => {
      setNewIngredient("");
      setDislikedIngredientError("");
    });
  };

  const removeDislikedIngredient = (ingredientToRemove: string) => {
    handleUpdatePreferences(
      () =>
        apiClient(
          "user/removeDislikedIngredient",
          true,
          ingredientToRemove.toLowerCase(),
        ),
      "Ingredient removed",
      "Failed to remove disliked ingredient",
    );
  };

  const dietGroups = useMemo(
    () => getDietOptionGroups(dietOptions),
    [dietOptions],
  );

  const availableDietValues = useMemo(
    () =>
      new Set(
        dietGroups.flatMap((group) =>
          group.options.map((option) => option.value),
        ),
      ),
    [dietGroups],
  );

  const currentDietValues = useMemo(() => {
    const serverDiets = user?.preferences?.diets;
    if (Array.isArray(serverDiets) && serverDiets.length > 0) {
      return serverDiets.map((diet) => normalizeDietValue(diet));
    }

    const fallbackDiet = normalizeDietValue(user?.preferences?.diet || "");
    return fallbackDiet ? [fallbackDiet] : [NONE_DIET_VALUE];
  }, [user?.preferences?.diets, user?.preferences?.diet]);

  useEffect(() => {
    if (availableDietValues.size === 0) {
      return;
    }

    const sanitized = sanitizeDietSelection(
      currentDietValues,
      availableDietValues,
    );
    if (sanitized.length > 0) {
      setSelectedDiets(sanitized);
      return;
    }

    if (availableDietValues.has(NONE_DIET_VALUE)) {
      setSelectedDiets([NONE_DIET_VALUE]);
    }
  }, [availableDietValues, currentDietValues]);

  const persistSelectedDiets = async (
    nextSelection: string[],
    previousSelection: string[],
  ) => {
    setDietSaving(true);
    try {
      const response = await apiClient("user/changeDiets", true, nextSelection);
      setUser((previousUser) =>
        previousUser
          ? {
              ...previousUser,
              preferences: response,
            }
          : previousUser,
      );
    } catch (err) {
      setSelectedDiets(previousSelection);
      setError("Failed to update diet preferences");
      console.error("Failed to update diets", err);
    } finally {
      setDietSaving(false);
    }
  };

  const handleToggleDiet = (dietValue: string) => {
    const normalizedValue = normalizeDietValue(dietValue);

    setSelectedDiets((previous) => {
      let nextSelection = [...previous];
      const isSelected = nextSelection.includes(normalizedValue);

      if (normalizedValue === NONE_DIET_VALUE) {
        nextSelection = isSelected ? [] : [NONE_DIET_VALUE];
      } else {
        if (isSelected) {
          nextSelection = nextSelection.filter(
            (value) => value !== normalizedValue,
          );
        } else {
          nextSelection = nextSelection
            .filter((value) => value !== NONE_DIET_VALUE)
            .concat(normalizedValue);
        }
      }

      const sanitized = sanitizeDietSelection(
        nextSelection,
        availableDietValues,
      );
      const finalSelection =
        sanitized.length > 0
          ? sanitized
          : availableDietValues.has(NONE_DIET_VALUE)
            ? [NONE_DIET_VALUE]
            : [];

      const previousSelection =
        previous.length > 0 ? previous : [NONE_DIET_VALUE];
      void persistSelectedDiets(finalSelection, previousSelection);

      return finalSelection;
    });
  };

  if (userLoading || loading) {
    return <PreferencesPageSkeleton />;
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  const dislikedIngredients = user.preferences?.dislikedIngredients || [];
  const selectedDietLabels = selectedDiets.map((value) => getDietLabel(value));
  const activeDiet =
    selectedDietLabels.length === 0
      ? "Not set"
      : selectedDietLabels.length <= 2
        ? selectedDietLabels.join(", ")
        : `${selectedDietLabels.slice(0, 2).join(", ")} +${selectedDietLabels.length - 2}`;
  const accountPlan = (user.subscriptionPlan || "FREE").toUpperCase();
  const recipesCreated = user.recipesCreated ?? 0;
  const recipeCreationLimit = user.recipeCreationLimit ?? -1;
  const hasUnlimitedRecipes = recipeCreationLimit < 0;
  const recipesRemaining = user.recipesRemaining;
  const recipeUsageLabel = hasUnlimitedRecipes
    ? `${recipesCreated} requests today • unlimited`
    : `${recipesCreated}/${recipeCreationLimit} requests today`;

  return (
    <div className="mobile-page-enter min-h-screen w-full bg-background">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <ProfileSummaryCard
          accountPlan={accountPlan}
          activeDiet={activeDiet}
          recipeUsageLabel={recipeUsageLabel}
          dislikedIngredientsCount={dislikedIngredients.length}
        />

        <ErrorAlert
          message={error}
          className="mb-6"
          onAutoHide={() => setError("")}
        />

        {showRegistrationOnboarding && (
          <div className="mb-6 rounded-xl border border-accent/40 bg-accent/15 p-4 text-text">
            <p className="font-semibold">Account created successfully.</p>
            <p className="mt-1 text-sm text-text/80">
              Choose your diet and disliked ingredients now to get better recipe
              suggestions from the start.
            </p>
          </div>
        )}

        {successMessage && (
          <div
            className="mb-6 flex items-start gap-2 rounded-xl border border-accent/45 bg-accent/15 p-4 text-text"
            role="status"
          >
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">
              ✓
            </span>
            <span>{successMessage}</span>
          </div>
        )}

        <div className="mobile-card-enter mobile-card-delay-1 ambient-gradient-card rounded-2xl border border-primary/10 bg-secondary p-5 shadow-sm sm:p-6">
          <PlanLimitsPanel
            accountPlan={accountPlan}
            hasUnlimitedRecipes={hasUnlimitedRecipes}
            recipeCreationLimit={recipeCreationLimit}
            recipesRemaining={recipesRemaining}
            recipeCreationLimitReached={user.recipeCreationLimitReached}
          />

          <DietaryPlanPanel
            dietGroups={dietGroups}
            selectedDiets={selectedDiets}
            dietSaving={dietSaving}
            onToggleDiet={handleToggleDiet}
          />

          <DislikedIngredientsPanel
            newIngredient={newIngredient}
            onNewIngredientChange={(value) => {
              setNewIngredient(value);
              if (dislikedIngredientError) {
                setDislikedIngredientError("");
              }
            }}
            onAddIngredient={addDislikedIngredient}
            dislikedIngredients={dislikedIngredients}
            preferencesLoaded={preferencesLoaded}
            onRemoveIngredient={removeDislikedIngredient}
            validationMessage={dislikedIngredientError}
          />
        </div>
      </div>
    </div>
  );
};

export default MePage;
