import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFridge } from "../context/fridgeContext";
import { useUser } from "../context/context";
import { captureEvent } from "../lib/posthog";
import { savePendingRecipeSearch } from "../lib/pendingRecipeIntent";
import { apiClient } from "../lib/hooks";
import ButtonsForm from "../components/ButtonsForm";
import type { RecipeData } from "./RecipePage";
import homepageIcon160 from "../assets/dish-genie-homepage-icon-160.webp";
import homepageIcon288 from "../assets/dish-genie-homepage-icon-288.webp";
import barcodeScanningGif from "../assets/landing/barcode-scanning.gif";
import fridgeScreenshot from "../assets/landing/fridge.jpeg";
import recipeActionsScreenshot from "../assets/landing/recipe-actions.jpeg";
import recipeOptionsScreenshot from "../assets/landing/recipe-options.jpeg";
import shoppingListScreenshot from "../assets/landing/shopping-list.jpeg";

const homepageIconSrcSet = `${homepageIcon160} 160w, ${homepageIcon288} 288w`;

const landingScreenshots = [
  {
    title: "Get 3 realistic options",
    body: "Type what is in the kitchen and compare a small dinner set.",
    src: recipeOptionsScreenshot,
    alt: "Dish Genie screen showing three generated recipe options",
  },
  {
    title: "Choose dinner, then act",
    body: "Cook the best idea, save it, or add useful missing items.",
    src: recipeActionsScreenshot,
    alt: "Dish Genie recipe screen with shopping list and save recipe buttons",
  },
  {
    title: "Add only optional extras",
    body: "The shopping list starts from the recipe you chose, not a manual chore.",
    src: shoppingListScreenshot,
    alt: "Dish Genie shopping list screen with ingredients to check off",
  },
  {
    title: "Scan groceries fast",
    body: "Add products by barcode when you restock the fridge.",
    src: barcodeScanningGif,
    alt: "Dish Genie barcode scanning screen recording",
  },
  {
    title: "Use what is already there",
    body: "Fridge ingredients can make future ideas more practical.",
    src: fridgeScreenshot,
    alt: "Dish Genie fridge screen with quick add options and saved ingredients",
  },
];

const allLandingScreenshotIndexes = landingScreenshots.map((_, index) => index);

type TradeoffKey = "time" | "effort" | "mood" | "pantry" | "flavor";

const defaultTradeoffValues: Record<TradeoffKey, number> = {
  time: 50,
  effort: 50,
  mood: 50,
  pantry: 50,
  flavor: 50,
};

const tradeoffSliders: Array<{
  key: TradeoffKey;
  label: string;
  lowLabel: string;
  highLabel: string;
  lowPrompt: string;
  highPrompt: string;
}> = [
  {
    key: "time",
    label: "Time",
    lowLabel: "Quick",
    highLabel: "Relaxed",
    lowPrompt: "quick",
    highPrompt: "slow relaxed cooking",
  },
  {
    key: "effort",
    label: "Effort",
    lowLabel: "Low effort",
    highLabel: "Involved",
    lowPrompt: "low effort",
    highPrompt: "more involved",
  },
  {
    key: "mood",
    label: "Mood",
    lowLabel: "Comfort",
    highLabel: "Fresh",
    lowPrompt: "comfort food",
    highPrompt: "fresh light food",
  },
  {
    key: "pantry",
    label: "Pantry fit",
    lowLabel: "Use mine",
    highLabel: "Can shop",
    lowPrompt: "use only ingredients I already have",
    highPrompt: "ok to suggest a few missing items",
  },
  {
    key: "flavor",
    label: "Flavor intensity",
    lowLabel: "Mild",
    highLabel: "Spicy",
    lowPrompt: "mild flavor",
    highPrompt: "spicy bold flavor",
  },
];

const recipeConstraints = [
  {
    label: "No shopping",
    prompt: "no shopping",
  },
  {
    label: "Low cleanup",
    prompt: "low cleanup",
  },
  {
    label: "Use soon",
    prompt: "use soon",
  },
  {
    label: "High protein",
    prompt: "high protein",
  },
  {
    label: "Cheap",
    prompt: "cheap",
  },
  {
    label: "Kid-friendly",
    prompt: "kid friendly",
  },
];

const mealTypes = ["Dinner", "Lunch", "Breakfast", "Snack"];
const LOGGED_IN_HOME_ONBOARDING_PREFIX = "dishGenie:homeOnboardingSeen";
const RECENT_RECIPE_LIMIT = 3;

const getLoggedInHomeOnboardingKey = (userId: number) =>
  `${LOGGED_IN_HOME_ONBOARDING_PREFIX}:${userId}`;

const chooserPresets: Array<{
  label: string;
  tradeoffs: Record<TradeoffKey, number>;
  constraints: string[];
}> = [
  {
    label: "Tired weeknight",
    tradeoffs: {
      ...defaultTradeoffValues,
      time: 0,
      effort: 0,
      pantry: 0,
    },
    constraints: ["Low cleanup"],
  },
  {
    label: "Use leftovers",
    tradeoffs: {
      ...defaultTradeoffValues,
      time: 0,
      pantry: 0,
    },
    constraints: ["Use soon", "No shopping"],
  },
  {
    label: "Healthy-ish",
    tradeoffs: {
      ...defaultTradeoffValues,
      mood: 100,
    },
    constraints: ["High protein"],
  },
  {
    label: "Cheap dinner",
    tradeoffs: {
      ...defaultTradeoffValues,
      pantry: 0,
    },
    constraints: ["Cheap", "No shopping"],
  },
  {
    label: "Craving comfort",
    tradeoffs: {
      ...defaultTradeoffValues,
      mood: 0,
    },
    constraints: ["Low cleanup"],
  },
];

const buildPresetSummary = (
  preset: (typeof chooserPresets)[number],
  options: { compact?: boolean } = {},
) =>
  tradeoffSliders
    .map((slider) => {
      const value = preset.tradeoffs[slider.key];

      if (options.compact && slider.key === "pantry" && value <= 25) {
        return undefined;
      }

      if (value <= 25) {
        return slider.lowLabel.toLowerCase();
      }

      if (value >= 75) {
        return slider.highLabel.toLowerCase();
      }

      return undefined;
    })
    .filter(Boolean)
    .concat(preset.constraints.map((constraint) => constraint.toLowerCase()))
    .join(", ");

const landingContrasts = [
  {
    title: "Not an endless recipe feed",
    body: "You get three realistic options instead of another page of inspiration.",
  },
  {
    title: "Not a fridge inventory chore",
    body: "Start by typing what you have. Saved fridge items can help later.",
  },
  {
    title: "Not weird AI recipes",
    body: "See what is used, what is missing, and why the idea fits dinner.",
  },
];

interface PagedRecipesResponse {
  content: RecipeData[];
  totalPages?: number;
}

const HomePage = () => {
  const [search, setSearch] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [tradeoffValues, setTradeoffValues] =
    useState<Record<TradeoffKey, number>>(defaultTradeoffValues);
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([]);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(
    "Dinner",
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoggedInOnboardingDismissed, setIsLoggedInOnboardingDismissed] =
    useState(false);
  const [showLoggedInHelp, setShowLoggedInHelp] = useState(false);
  const [recentRecipes, setRecentRecipes] = useState<RecipeData[]>([]);
  const [isRecentRecipesLoading, setIsRecentRecipesLoading] = useState(false);
  const [visibleScreenshotCards, setVisibleScreenshotCards] = useState<
    number[]
  >([]);
  const screenshotCardRefs = useRef<Array<HTMLElement | null>>([]);
  const navigate = useNavigate();
  const { fridgeItems } = useFridge();
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) {
      setIsLoggedInOnboardingDismissed(false);
      setRecentRecipes([]);
      return;
    }

    setIsLoggedInOnboardingDismissed(
      localStorage.getItem(getLoggedInHomeOnboardingKey(user.id)) === "true",
    );
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setIsRecentRecipesLoading(false);
      return;
    }

    let isMounted = true;

    const fetchRecentRecipes = async () => {
      setIsRecentRecipesLoading(true);

      try {
        const response = await apiClient<PagedRecipesResponse>(
          `getUserRecipes/${user.id}?page=0&size=${RECENT_RECIPE_LIMIT}&sort=id,desc`,
          false,
        );

        if (isMounted) {
          setRecentRecipes(
            Array.isArray(response.content) ? response.content : [],
          );
        }
      } catch {
        if (isMounted) {
          setRecentRecipes([]);
        }
      } finally {
        if (isMounted) {
          setIsRecentRecipesLoading(false);
        }
      }
    };

    fetchRecentRecipes();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setVisibleScreenshotCards(allLandingScreenshotIndexes);
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setVisibleScreenshotCards(allLandingScreenshotIndexes);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const index = Number(
            (entry.target as HTMLElement).dataset.screenshotIndex,
          );

          setVisibleScreenshotCards((current) =>
            current.includes(index) ? current : [...current, index],
          );
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.16,
      },
    );

    screenshotCardRefs.current.forEach((card) => {
      if (card) {
        observer.observe(card);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const buildCategoryPrompt = () => {
    const tradeoffPrompts = tradeoffSliders
      .map((slider) => {
        const value = tradeoffValues[slider.key];

        if (value <= 25) {
          return slider.lowPrompt;
        }

        if (value >= 75) {
          return slider.highPrompt;
        }

        return undefined;
      })
      .filter(Boolean);
    const constraintPrompts = selectedConstraints
      .map(
        (label) =>
          recipeConstraints.find((option) => option.label === label)?.prompt,
      )
      .filter(Boolean);
    const mealPrompt = selectedMealType
      ? `${selectedMealType.toLowerCase()} recipe`
      : undefined;

    return [...tradeoffPrompts, ...constraintPrompts, mealPrompt]
      .filter(Boolean)
      .join(" ")
      .trim();
  };

  const buildRecipeSearch = (searchValue = search) => {
    const categoryPrompt = buildCategoryPrompt();
    const customPrompt = searchValue.trim();
    let finalSearch = [categoryPrompt, customPrompt].filter(Boolean).join(" with ");

    if (!finalSearch) {
      finalSearch = "random recipe";
    } else if (hasIngredients) {
      const ingredientsText = fridgeItems.map((item) => item.name).join(", ");
      finalSearch += " and try to use those ingredients: " + ingredientsText;
    }
    return finalSearch;
  };

  const startRecipeFlow = (searchValue = search, cta: string) => {
    const finalSearch = buildRecipeSearch(searchValue);
    const adjustedTradeoffCount = Object.entries(tradeoffValues).filter(
      ([, value]) => value !== 50,
    ).length;

    captureEvent("marketing_cta_click", {
      cta,
      hasFridgeItems: hasIngredients,
      hasCustomInput: searchValue.trim() !== "",
      selectedCategoryCount:
        adjustedTradeoffCount +
        selectedConstraints.length +
        (selectedMealType ? 1 : 0),
      selectedPreset,
      selectedConstraints,
    });

    if (!user) {
      savePendingRecipeSearch(finalSearch);
      navigate("/login", {
        state: {
          from: {
            pathname: "/Recipe",
            state: { search: finalSearch },
          },
        },
      });
      return;
    }

    setIsNavigating(true);
    navigate("Recipe", { state: { search: finalSearch } });
  };

  const handleSearch = () => {
    startRecipeFlow(
      search,
      user ? "show_me_3_ideas" : "get_my_3_dinner_ideas",
    );
  };

  const renderPrimaryCta = (className = "") => (
    <button
      onClick={handleSearch}
      disabled={isNavigating}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 font-extrabold text-text shadow-[0_16px_32px_color-mix(in_srgb,var(--color-accent)_42%,transparent)] transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-[0_18px_36px_color-mix(in_srgb,var(--color-accent)_52%,transparent)] focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-wait disabled:translate-y-0 disabled:opacity-60 ${className}`}
    >
      {isNavigating ? (
        <>
          <span className="food-loader-inline" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="6" />
              <path d="M3 12h3m12 0h3M12 3v3m0 12v3" />
            </svg>
          </span>
          <span>Generating...</span>
        </>
      ) : (
        "Tell me what to cook"
      )}
    </button>
  );

  const handleClear = () => {
    setSearch("");
  };

  const handlePresetClick = (presetLabel: string) => {
    const preset = chooserPresets.find((option) => option.label === presetLabel);

    if (!preset) {
      return;
    }

    setSelectedPreset(preset.label);
    setTradeoffValues(preset.tradeoffs);
    setSelectedConstraints(preset.constraints);
  };

  const handleTradeoffChange = (key: TradeoffKey, value: number) => {
    setSelectedPreset(null);
    setTradeoffValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleConstraintToggle = (label: string) => {
    setSelectedPreset(null);
    setSelectedConstraints((current) =>
      current.includes(label)
        ? current.filter((constraint) => constraint !== label)
        : [...current, label],
    );
  };

  const handleBrowseLatest = () => {
    captureEvent("marketing_cta_click", {
      cta: "browse_public_recipes",
    });
    navigate("/Recipes");
  };

  const handleDismissLoggedInOnboarding = () => {
    if (user?.id) {
      localStorage.setItem(getLoggedInHomeOnboardingKey(user.id), "true");
    }

    setIsLoggedInOnboardingDismissed(true);
  };

  const hasIngredients = fridgeItems.length > 0;
  const recentFridgeItems = fridgeItems.slice(0, 8);
  const shouldShowLoggedInOnboarding =
    Boolean(user) && !isLoggedInOnboardingDismissed;
  const selectedPresetDetails = selectedPreset
    ? chooserPresets.find((preset) => preset.label === selectedPreset)
    : undefined;
  const selectedPresetSummary = selectedPresetDetails
    ? buildPresetSummary(selectedPresetDetails)
    : "";
  const selectedPresetCompactSummary = selectedPresetDetails
    ? buildPresetSummary(selectedPresetDetails, { compact: true })
    : "";

  return (
    <>
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <article className="relative z-10 mx-auto w-full max-w-4xl px-5 pb-5 pt-8 md:px-8 md:pt-12">
          <div
            className="animate-fadeIn text-center"
            style={{ animationDelay: "80ms" }}
          >
            <div className="mb-5 flex justify-center">
              <picture>
                <source
                  type="image/webp"
                  srcSet={homepageIconSrcSet}
                  sizes="(min-width: 768px) 144px, 112px"
                />
                <img
                  src="/dish-genie-homepage-icon.png"
                  alt="Dish Genie app icon with a chef hat, steam, and a cooking pot"
                  width="144"
                  height="144"
                  fetchPriority="high"
                  className="landing-icon-float h-28 w-28 object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.08)] md:h-36 md:w-36"
                />
              </picture>
            </div>
            <h1 className="mx-auto max-w-3xl px-2 text-4xl font-bold leading-tight text-text md:text-5xl">
              {user
                ? "What should we cook next?"
                : "Turn what's in your kitchen into dinner"}
            </h1>
            <p className="mx-auto mb-5 mt-4 max-w-2xl text-sm leading-relaxed text-text/70 md:mt-5 md:text-base">
              {user
                ? "Start with ingredients, pick a mode, and get a practical dinner idea from what you already know."
                : "Tell Dish Genie what you have and get 3 realistic ideas for tonight. No inventory setup. No endless recipe feed."}
            </p>
            <div className="mx-auto w-full max-w-3xl rounded-3xl border border-primary/10 bg-background/85 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.06)] md:p-5">
              <article className="relative w-full">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                  placeholder="eggs, rice, spinach, chicken"
                  className="w-full rounded-full border border-primary/20 bg-secondary/90 p-2 pr-10 text-text shadow-[0_8px_20px_rgba(0,0,0,0.04)] placeholder:text-text/50 focus:outline-none focus:ring-2 focus:ring-accent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />
                {search && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text/70 transition-colors hover:text-accent focus:outline-none"
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
              </article>
              <p className="mx-auto mt-3 max-w-2xl text-xs text-text/55 md:text-sm">
                Pick a mode, cook from defaults, or tune the details.
              </p>
              <section className="mx-auto max-w-3xl space-y-4 pb-1 pt-4">
                <section className="flex w-full flex-col items-center">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                    Mode
                  </h2>
                  <div className="flex w-full flex-wrap justify-center gap-2">
                    {chooserPresets.map((preset) => {
                      const isSelected = selectedPreset === preset.label;

                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handlePresetClick(preset.label)}
                          aria-pressed={isSelected}
                          className={`chooser-option-button min-h-10 rounded-full border px-3.5 py-2 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm ${
                            isSelected
                              ? "border-primary bg-primary text-background shadow-[0_12px_28px_rgba(0,0,0,0.16)] ring-2 ring-accent/65"
                              : "border-primary/10 bg-secondary/80 text-text/70 shadow-sm hover:-translate-y-0.5 hover:border-accent/70 hover:bg-background hover:text-text hover:shadow-md"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  {selectedPreset && (
                    <p className="chooser-summary-badge mt-3 max-w-full rounded-full border border-accent/45 bg-accent/15 px-3 py-1.5 text-xs font-bold text-primary">
                      <span className="md:hidden">
                        {selectedPreset}: {selectedPresetCompactSummary}
                      </span>
                      <span className="hidden md:inline">
                        {selectedPreset}: {selectedPresetSummary}
                      </span>
                    </p>
                  )}
                </section>
                {renderPrimaryCta()}
                <section className="chooser-details-card overflow-hidden rounded-2xl border border-primary/10 bg-[linear-gradient(180deg,var(--color-background),var(--color-secondary))] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(0,0,0,0.05)]">
                  <button
                    type="button"
                    onClick={() => setIsDetailsOpen((open) => !open)}
                    aria-expanded={isDetailsOpen}
                    className="chooser-details-toggle flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-extrabold text-text transition-colors hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    <span>{isDetailsOpen ? "Hide details" : "Tune details"}</span>
                    <span
                      className={`chooser-toggle-icon ${
                        isDetailsOpen ? "chooser-toggle-icon-open" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isDetailsOpen && (
                    <div className="chooser-details-panel space-y-5 border-t border-primary/10 px-4 pb-4 pt-4">
                      <section>
                        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                          Tradeoffs
                        </h2>
                        <div className="grid w-full gap-4 md:grid-cols-2">
                          {tradeoffSliders.map((slider, index) => {
                            const value = tradeoffValues[slider.key];
                            const selectedLabel =
                              value <= 25
                                ? slider.lowLabel
                                : value >= 75
                                  ? slider.highLabel
                                  : "Balanced";

                            return (
                              <label
                                key={slider.key}
                                className="chooser-detail-card rounded-xl border border-primary/10 bg-background p-3 shadow-sm"
                                style={{ animationDelay: `${index * 35}ms` }}
                              >
                                <span className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-extrabold text-text">
                                    {slider.label}
                                  </span>
                                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-text/65">
                                    Selected: {selectedLabel}
                                  </span>
                                </span>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="50"
                                  value={value}
                                  onChange={(event) =>
                                    handleTradeoffChange(
                                      slider.key,
                                      Number(event.target.value),
                                    )
                                  }
                                  aria-label={slider.label}
                                  className="chooser-range mt-3"
                                  style={
                                    {
                                      "--range-value": `${value}%`,
                                      "--range-thumb-color":
                                        "var(--color-accent)",
                                    } as CSSProperties
                                  }
                                />
                                <span className="mt-2 flex justify-between text-[11px] font-bold text-text/45">
                                  <span aria-hidden="true">
                                    {slider.lowLabel}
                                  </span>
                                  <span aria-hidden="true">
                                    {slider.highLabel}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </section>
                      <section>
                        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                          Stackable needs
                        </h2>
                        <div className="flex w-full flex-wrap gap-2">
                          {recipeConstraints.map((constraint, index) => {
                            const isSelected = selectedConstraints.includes(
                              constraint.label,
                            );

                            return (
                              <button
                                key={constraint.label}
                                type="button"
                                onClick={() =>
                                  handleConstraintToggle(constraint.label)
                                }
                                aria-pressed={isSelected}
                                className={`chooser-chip inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm ${
                                  isSelected
                                    ? "border-primary/70 bg-background text-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_14%,transparent),0_8px_16px_rgba(0,0,0,0.07)]"
                                    : "border-primary/10 bg-background text-text/65 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-secondary hover:text-text hover:shadow-sm"
                                }`}
                                style={{ animationDelay: `${index * 25}ms` }}
                              >
                                {isSelected && (
                                  <span
                                    className="chooser-chip-check"
                                    aria-hidden="true"
                                  />
                                )}
                                {constraint.label}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                      <ButtonsForm
                        options={mealTypes}
                        onButtonClick={(label) => {
                          setSelectedMealType(label);
                        }}
                        selectedButton={selectedMealType}
                        title="Meal"
                      />
                      {renderPrimaryCta("mt-1")}
                    </div>
                  )}
                </section>
              </section>
            </div>
          </div>
          {shouldShowLoggedInOnboarding && (
            <section className="mx-auto mt-4 max-w-3xl rounded-2xl border border-primary/10 bg-secondary/70 p-4 text-left shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                    Quick setup
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-text">
                    Your home screen is now the cooking workflow.
                  </h2>
                  <ul className="mt-3 space-y-1.5 text-sm text-text/65">
                    <li>1. Add what you have in the input.</li>
                    <li>2. Pick a dinner mode or tune details.</li>
                    <li>3. Use fridge items and saved recipes below.</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={handleDismissLoggedInOnboarding}
                  className="rounded-full border border-primary/15 bg-background px-4 py-2 text-sm font-bold text-text shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  Got it
                </button>
              </div>
            </section>
          )}
          {!user && (
            <div className="mt-4 text-center">
              <button
                onClick={handleBrowseLatest}
                className="mobile-soft-press rounded-full border border-primary/10 bg-background/80 px-4 py-2 text-sm font-semibold text-text shadow-sm transition-colors hover:border-accent/60 hover:text-accent"
              >
                Browse latest public recipes
              </button>
            </div>
          )}
        </article>

        {user && (
          <section className="relative z-10 mx-auto grid w-full max-w-6xl gap-4 px-5 pb-10 md:grid-cols-[1.1fr_0.9fr] md:px-8">
            <article className="rounded-2xl border border-primary/10 bg-background p-4 text-left shadow-[0_14px_34px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                    Saved fridge
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-text">
                    Ingredients ready to use
                  </h2>
                </div>
                <Link
                  to="/Fridge"
                  className="rounded-full border border-primary/10 px-3 py-1.5 text-sm font-bold text-text/70 transition-all hover:border-primary/25 hover:bg-secondary hover:text-text"
                >
                  Manage
                </Link>
              </div>
              {recentFridgeItems.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {recentFridgeItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSearch((current) =>
                          current.trim()
                            ? `${current.trim()}, ${item.name}`
                            : item.name,
                        );
                      }}
                      className="rounded-full border border-primary/15 bg-secondary px-3 py-2 text-sm font-bold text-text transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background hover:shadow-sm"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-primary/15 bg-secondary/60 p-4">
                  <p className="text-sm text-text/65">
                    Add a few staples to make future dinner ideas more useful.
                  </p>
                  <Link
                    to="/Fridge"
                    className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-bold text-background transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    Add fridge items
                  </Link>
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-primary/10 bg-background p-4 text-left shadow-[0_14px_34px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                    Recent dinners
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-text">
                    Saved recipes
                  </h2>
                </div>
                <Link
                  to="/Recipes"
                  className="rounded-full border border-primary/10 px-3 py-1.5 text-sm font-bold text-text/70 transition-all hover:border-primary/25 hover:bg-secondary hover:text-text"
                >
                  View all
                </Link>
              </div>
              {isRecentRecipesLoading ? (
                <div className="mt-4 space-y-2">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-12 animate-pulse rounded-xl bg-secondary"
                    />
                  ))}
                </div>
              ) : recentRecipes.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {recentRecipes.map((recipe) => (
                    <Link
                      key={recipe.id ?? recipe.name}
                      to={recipe.id ? `/Recipe/${recipe.id}` : "/Recipes"}
                      className="block rounded-xl border border-primary/10 bg-secondary/60 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-background hover:shadow-sm"
                    >
                      <h3 className="line-clamp-1 text-sm font-bold text-text">
                        {recipe.name || recipe.title}
                      </h3>
                      {recipe.timeToPrepare && (
                        <p className="mt-1 text-xs font-semibold text-text/50">
                          {recipe.timeToPrepare}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-primary/15 bg-secondary/60 p-4">
                  <p className="text-sm text-text/65">
                    Saved dinners will show here after you keep a recipe.
                  </p>
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-primary/10 bg-secondary/55 p-4 text-left md:col-span-2">
              <button
                type="button"
                onClick={() => setShowLoggedInHelp((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left text-sm font-extrabold text-text"
                aria-expanded={showLoggedInHelp}
              >
                <span>How it works</span>
                <span className="text-text/45">
                  {showLoggedInHelp ? "Hide" : "Show"}
                </span>
              </button>
              {showLoggedInHelp && (
                <div className="mt-3 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {landingContrasts.map((contrast) => (
                      <div
                        key={contrast.title}
                        className="rounded-lg border border-primary/10 bg-background p-3"
                      >
                        <h3 className="text-sm font-bold text-text">
                          {contrast.title}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-text/65">
                          {contrast.body}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {landingScreenshots.map((screenshot) => (
                      <article
                        key={screenshot.src}
                        className="overflow-hidden rounded-xl border border-primary/10 bg-background shadow-sm"
                      >
                        <img
                          src={screenshot.src}
                          alt={screenshot.alt}
                          loading="lazy"
                          className="h-52 w-full bg-secondary/40 object-contain object-top lg:h-48"
                        />
                        <div className="p-3">
                          <h3 className="text-sm font-bold text-text">
                            {screenshot.title}
                          </h3>
                          <p className="mt-1.5 text-xs leading-relaxed text-text/60">
                            {screenshot.body}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </article>
          </section>
        )}

        {!user && (
          <>
            <section className="landing-scroll-reveal relative z-10 border-y border-primary/10 bg-secondary/45 py-8">
              <div className="mx-auto grid w-full max-w-6xl gap-5 px-5 md:grid-cols-[1fr_1.7fr] md:px-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                    Fewer choices, faster dinner
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-text">
                    Dish Genie is built for the kitchen moment before you order
                    takeout.
                  </h2>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {landingContrasts.map((contrast) => (
                    <article
                      key={contrast.title}
                      className="rounded-lg border border-primary/10 bg-background p-4"
                    >
                      <h3 className="text-sm font-bold text-text">
                        {contrast.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-text/65">
                        {contrast.body}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="landing-scroll-reveal relative z-10 mx-auto mb-10 w-full max-w-6xl px-5 pt-12 md:px-8 md:pt-16">
              <div className="mb-5 text-center">
                <h2 className="text-xl font-bold text-text">
                  How Dish Genie helps after you choose
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-text/65">
                  Real app screens, shown as a simple flow: choose, cook, shop,
                  scan, then reuse what is already in the fridge.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {landingScreenshots.map((screenshot, index) => (
                  <article
                    key={screenshot.src}
                    ref={(node) => {
                      screenshotCardRefs.current[index] = node;
                    }}
                    data-screenshot-index={index}
                    style={{ transitionDelay: `${index * 85}ms` }}
                    className={`landing-screenshot-card landing-proof-card overflow-hidden rounded-2xl border border-primary/10 bg-background shadow-[0_18px_42px_rgba(0,0,0,0.08)] ${
                      visibleScreenshotCards.includes(index)
                        ? "landing-proof-card-visible"
                        : ""
                    }`}
                  >
                    <img
                      src={screenshot.src}
                      alt={screenshot.alt}
                      loading="lazy"
                      className="h-72 w-full bg-secondary/40 object-contain object-top sm:h-80 xl:h-72"
                    />
                    <div className="p-4">
                      <h3 className="text-sm font-bold text-text">
                        {screenshot.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-text/65">
                        {screenshot.body}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </>
  );
};

export default HomePage;
