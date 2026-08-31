import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFridge } from "../context/fridgeContext";
import { useUser } from "../context/context";
import { useLanguage } from "../context/languageContext";
import { captureEvent } from "../lib/posthog";
import { savePendingRecipeSearch } from "../lib/pendingRecipeIntent";
import { apiClient } from "../lib/hooks";
import { landingFaqs } from "../lib/landingContent";
import { featuredRecipes } from "../lib/featuredRecipes";
import ButtonsForm from "../components/ButtonsForm";
import RecipeContainer from "../components/RecipeContainer";
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
const landingRevealSectionIndexes = [0, 1, 2, 3, 4, 5];

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
    title: "Three options, not a feed",
    body: "Compare the best overall dinner, the fastest option, and the best use-it-up idea.",
  },
  {
    title: "Ingredients first",
    body: "Start with eggs, rice, spinach, chicken, or whatever is already in the kitchen.",
  },
  {
    title: "Not weird AI recipes",
    body: "Each idea explains what it uses, what is missing, and why it makes sense.",
  },
];

const practicalProofItems = [
  "which ingredients from your kitchen it uses",
  "what is missing before you start cooking",
  "whether dinner works without shopping",
  "why the option fits your time, effort, and mood",
  "which idea is fastest, best overall, or best for using food up",
];

const dinnerDecisionOptions = [
  {
    label: "Best overall",
    example: "Chicken, rice, and spinach skillet",
    body: "Balanced for flavor, effort, and pantry fit when you want the most reliable dinner.",
  },
  {
    label: "Fastest",
    example: "Egg fried rice with spinach",
    body: "The shortest route from ingredients to food when time and cleanup matter most.",
  },
  {
    label: "Use-it-up",
    example: "Spinach chicken rice bowls",
    body: "Prioritizes ingredients that should be used soon so less food gets wasted.",
  },
];

const ingredientSearchExamples = [
  "what can I cook with eggs and rice",
  "dinner ideas with ingredients I have",
  "what can I cook without shopping",
  "recipes from ingredients at home",
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
  const [visibleLandingSections, setVisibleLandingSections] = useState<
    number[]
  >([]);
  const screenshotCardRefs = useRef<Array<HTMLElement | null>>([]);
  const landingSectionRefs = useRef<Array<HTMLElement | null>>([]);
  const navigate = useNavigate();
  const { fridgeItems } = useFridge();
  const { user } = useUser();
  const { t } = useLanguage();

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

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setVisibleLandingSections(landingRevealSectionIndexes);
      return;
    }

    const settleDelay = 2600;
    let retryTimeout = 0;
    let revealInterval = 0;

    const collectRevealElements = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>("[data-landing-reveal-index]"),
      );

    const revealVisibleItems = (element: HTMLElement) => {
      const animatedItems = Array.from(
        element.querySelectorAll<HTMLElement>(".landing-animate-item"),
      );

      animatedItems.forEach((item) => {
        const itemRect = item.getBoundingClientRect();
        const isItemVisible =
          itemRect.top < window.innerHeight * 0.84 && itemRect.bottom > 0;

        if (isItemVisible) {
          item.classList.add("landing-animate-item-visible");
        }
      });
    };

    const updateVisibleSections = () => {
      const nextVisibleIndexes = collectRevealElements()
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const index = Number(element.dataset.landingRevealIndex);
          const isNearViewport =
            rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
          const shouldReveal =
            isNearViewport ||
            element.classList.contains("landing-scroll-reveal-visible");

          if (shouldReveal) {
            element.classList.add("landing-scroll-reveal-visible");
            revealVisibleItems(element);

            if (element.dataset.landingRevealSettling !== "true") {
              element.dataset.landingRevealSettling = "true";
              window.setTimeout(() => {
                element.classList.add("landing-scroll-reveal-settled");
              }, settleDelay);
            }
          }

          return shouldReveal ? index : undefined;
        })
        .filter((index): index is number => index !== undefined);

      if (!nextVisibleIndexes.length) {
        return;
      }

      setVisibleLandingSections((current) => {
        const next = Array.from(new Set([...current, ...nextVisibleIndexes]));
        return next.length === current.length ? current : next;
      });

      if (
        nextVisibleIndexes.length &&
        document.querySelectorAll(".landing-scroll-reveal-visible").length >=
          landingRevealSectionIndexes.length &&
        revealInterval
      ) {
        window.clearInterval(revealInterval);
        revealInterval = 0;
      }
    };

    const startRevealWatcher = () => {
      if (!collectRevealElements().length) {
        retryTimeout = window.setTimeout(startRevealWatcher, 50);
        return;
      }

      updateVisibleSections();
      revealInterval = window.setInterval(updateVisibleSections, 180);
      window.addEventListener("scroll", updateVisibleSections, {
        passive: true,
      });
      window.addEventListener("resize", updateVisibleSections);
    };

    startRevealWatcher();

    return () => {
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
      }

      if (revealInterval) {
        window.clearInterval(revealInterval);
      }

      window.removeEventListener("scroll", updateVisibleSections);
      window.removeEventListener("resize", updateVisibleSections);
    };
  }, [user]);

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
    const finalSearch = [categoryPrompt, customPrompt].filter(Boolean).join(" with ");

    if (!finalSearch) {
      return "random recipe";
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
          <span>{t("Generating...")}</span>
        </>
      ) : (
        t(user ? "Show me 3 ideas" : "Get my 3 dinner ideas")
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
                  alt={t("Dish Genie app icon with a chef hat, steam, and a cooking pot")}
                  width="144"
                  height="144"
                  fetchPriority="high"
                  className="landing-icon-float h-28 w-28 object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.08)] md:h-36 md:w-36"
                />
              </picture>
            </div>
            <h1 className="mx-auto max-w-3xl px-2 text-4xl font-bold leading-tight text-text md:text-5xl">
              {t(
                user
                  ? "What should we cook next?"
                  : "What can I cook with these ingredients?",
              )}
            </h1>
            <p className="mx-auto mb-5 mt-4 max-w-2xl text-sm leading-relaxed text-text/70 md:mt-5 md:text-base">
              {t(
                user
                  ? "Start with ingredients, pick a mode, and get a practical dinner idea from what you already know."
                  : "Type what you have at home and Dish Genie gives you 3 realistic dinner ideas for tonight: best overall, fastest, and use-it-up.",
              )}
            </p>
            <div className="mx-auto w-full max-w-3xl rounded-3xl border border-primary/10 bg-background/85 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.06)] md:p-5">
              <article className="relative w-full">
                <label htmlFor="ingredient-search" className="sr-only">
                  {t("Ingredients you have")}
                </label>
                <input
                  id="ingredient-search"
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                  placeholder={t("eggs, rice, spinach, chicken")}
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
                  aria-label={t("Clear search")}
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
                {t(
                  "Try eggs, rice, spinach, chicken, leftovers, or the ingredients you need to use before they go bad.",
                )}
              </p>
              <section className="mx-auto max-w-3xl space-y-4 pb-1 pt-4">
                <section className="flex w-full flex-col items-center">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                    {t("Mode")}
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
                          {t(preset.label)}
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
                    <span>
                      {t(isDetailsOpen ? "Hide details" : "Tune details")}
                    </span>
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
                          {t("Tradeoffs")}
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
                                    {t(slider.label)}
                                  </span>
                                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-text/65">
                                    {t("Selected: {value}", {
                                      value: t(selectedLabel),
                                    })}
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
                                  aria-label={t(slider.label)}
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
                                    {t(slider.lowLabel)}
                                  </span>
                                  <span aria-hidden="true">
                                    {t(slider.highLabel)}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </section>
                      <section>
                        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                          {t("Stackable needs")}
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
                                {t(constraint.label)}
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
                    {t("Quick setup")}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-text">
                    {t("Your home screen is now the cooking workflow.")}
                  </h2>
                  <ul className="mt-3 space-y-1.5 text-sm text-text/65">
                    <li>{t("1. Add what you have in the input.")}</li>
                    <li>{t("2. Pick a dinner mode or tune details.")}</li>
                    <li>{t("3. Use fridge items and saved recipes below.")}</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={handleDismissLoggedInOnboarding}
                  className="rounded-full border border-primary/15 bg-background px-4 py-2 text-sm font-bold text-text shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  {t("Got it")}
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
                {t("Browse latest public recipes")}
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
                    {t("Saved fridge")}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-text">
                    {t("Ingredients ready to use")}
                  </h2>
                </div>
                <Link
                  to="/Fridge"
                  className="rounded-full border border-primary/10 px-3 py-1.5 text-sm font-bold text-text/70 transition-all hover:border-primary/25 hover:bg-secondary hover:text-text"
                >
                  {t("Manage")}
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
                    {t("Add a few staples to make future dinner ideas more useful.")}
                  </p>
                  <Link
                    to="/Fridge"
                    className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-bold text-background transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {t("Add fridge items")}
                  </Link>
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-primary/10 bg-background p-4 text-left shadow-[0_14px_34px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                    {t("Recent dinners")}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-text">
                    {t("Saved recipes")}
                  </h2>
                </div>
                <Link
                  to="/Recipes"
                  className="rounded-full border border-primary/10 px-3 py-1.5 text-sm font-bold text-text/70 transition-all hover:border-primary/25 hover:bg-secondary hover:text-text"
                >
                  {t("View all")}
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
                    {t("Saved dinners will show here after you keep a recipe.")}
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
                <span>{t("How it works")}</span>
                <span className="text-text/45">
                  {t(showLoggedInHelp ? "Hide" : "Show")}
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
                          {t(contrast.title)}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-text/65">
                          {t(contrast.body)}
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
                          alt={t(screenshot.alt)}
                          loading="lazy"
                          className="h-52 w-full bg-secondary/40 object-contain object-top lg:h-48"
                        />
                        <div className="p-3">
                          <h3 className="text-sm font-bold text-text">
                            {t(screenshot.title)}
                          </h3>
                          <p className="mt-1.5 text-xs leading-relaxed text-text/60">
                            {t(screenshot.body)}
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
            <section
              ref={(node) => {
                landingSectionRefs.current[0] = node;
              }}
              data-landing-reveal-index="0"
              className={`landing-scroll-reveal landing-polished-band relative z-10 border-y border-primary/10 py-10 md:py-12 ${
                visibleLandingSections.includes(0)
                  ? "landing-scroll-reveal-visible"
                  : ""
              }`}
            >
              <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 md:grid-cols-[0.9fr_1.1fr] md:items-center md:px-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                    {t("Practical AI recipes")}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold leading-tight text-text md:text-3xl">
                    {t("Not another weird AI recipe generator")}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-text/65 md:text-base">
                    {t(
                      "Dish Genie is designed for practical dinner decisions, not novelty recipes. It should be obvious why each suggestion belongs on your table tonight.",
                    )}
                  </p>
                </div>
                <div className="landing-animate-item landing-polished-panel rounded-2xl p-4 transition-all md:p-5">
                  <p className="text-sm font-extrabold text-text">
                    {t("Each suggestion makes clear:")}
                  </p>
                  <ul className="mt-4 grid gap-2 text-sm leading-6 text-text/70 sm:grid-cols-2">
                    {practicalProofItems.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span
                          className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent"
                          aria-hidden="true"
                        />
                        <span>{t(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section
              ref={(node) => {
                landingSectionRefs.current[1] = node;
              }}
              data-landing-reveal-index="1"
              className={`landing-scroll-reveal relative z-10 mx-auto w-full max-w-6xl px-5 pt-12 md:px-8 md:pt-16 ${
                visibleLandingSections.includes(1)
                  ? "landing-scroll-reveal-visible"
                  : ""
              }`}
            >
              <div className="grid gap-6 md:grid-cols-[0.85fr_1.15fr] md:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                    {t("Food at home, no plan")}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold leading-tight text-text md:text-3xl">
                    {t(
                      "What to cook when you have ingredients but no dinner idea",
                    )}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-text/65 md:text-base">
                    {t(
                      "Instead of forcing you into one recipe, Dish Genie turns your ingredient list into a small decision set you can compare by time, missing items, and food that needs using.",
                    )}
                  </p>
                  <div className="landing-mobile-chip-row mt-4 flex flex-wrap gap-2">
                    {ingredientSearchExamples.map((example) => (
                      <span
                        key={example}
                        className="rounded-full border border-primary/10 bg-secondary px-3 py-1.5 text-xs font-bold text-text/60"
                      >
                        {t(example)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3">
                  {dinnerDecisionOptions.map((option, index) => (
                    <article
                      key={option.label}
                      className={`landing-animate-item landing-feature-card ${
                        index % 2 === 0
                          ? "landing-side-right"
                          : "landing-side-left"
                      } rounded-lg border border-primary/10 bg-background p-4 shadow-sm`}
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                        <h3 className="text-base font-extrabold text-text">
                          {t(option.label)}
                        </h3>
                        <p className="text-sm font-bold text-text/45">
                          {t(option.example)}
                        </p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-text/65">
                        {t(option.body)}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section
              ref={(node) => {
                landingSectionRefs.current[2] = node;
              }}
              data-landing-reveal-index="2"
              className={`landing-scroll-reveal relative z-10 mx-auto w-full max-w-6xl px-5 pt-12 md:px-8 md:pt-16 ${
                visibleLandingSections.includes(2)
                  ? "landing-scroll-reveal-visible"
                  : ""
              }`}
            >
              <div className="grid gap-6 md:grid-cols-[0.85fr_1.15fr] md:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                    {t("Featured recipes")}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold leading-tight text-text md:text-3xl">
                    {t("Realistic ideas worth clicking")}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-text/65 md:text-base">
                    {t(
                      "These examples use the same recipe shape Dish Genie creates: a practical title, cooking time, ingredients, nutrition, and clear steps.",
                    )}
                  </p>
                </div>
                <div className="space-y-3 md:space-y-4">
                  {featuredRecipes.map((recipe, index) => (
                    <div
                      key={recipe.slug}
                      className={`landing-animate-item landing-recipe-link ${
                        index % 2 === 0
                          ? "landing-side-right"
                          : "landing-side-left"
                      }`}
                      style={{ transitionDelay: `${index * 50}ms` }}
                    >
                      <RecipeContainer
                        title={recipe.name}
                        timeToPrepare={recipe.timeToPrepare}
                        to={`/featured-recipes/${recipe.slug}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              ref={(node) => {
                landingSectionRefs.current[4] = node;
              }}
              data-landing-reveal-index="4"
              className={`landing-scroll-reveal relative z-10 mx-auto w-full max-w-6xl px-5 pt-12 md:px-8 md:pt-16 ${
                visibleLandingSections.includes(4)
                  ? "landing-scroll-reveal-visible"
                  : ""
              }`}
            >
              <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text/45">
                    {t("Common questions")}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold leading-tight text-text md:text-3xl">
                    {t("Cooking from what you already have")}
                  </h2>
                </div>
                <div className="grid gap-3">
                  {landingFaqs.map((item, index) => (
                    <article
                      key={item.question}
                      className={`landing-animate-item landing-feature-card ${
                        index % 2 === 0
                          ? "landing-side-right"
                          : "landing-side-left"
                      } rounded-lg border border-primary/10 bg-background p-4 shadow-sm`}
                    >
                      <h3 className="text-base font-extrabold text-text">
                        {t(item.question)}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-text/65">
                        {t(item.answer)}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section
              ref={(node) => {
                landingSectionRefs.current[5] = node;
              }}
              data-landing-reveal-index="5"
              className={`landing-scroll-reveal relative z-10 mx-auto mb-10 w-full max-w-6xl px-5 pt-12 md:px-8 md:pt-16 ${
                visibleLandingSections.includes(5)
                  ? "landing-scroll-reveal-visible"
                  : ""
              }`}
            >
              <div className="mb-5 text-center">
                <h2 className="text-xl font-bold text-text">
                  {t("How Dish Genie helps after you choose")}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-text/65">
                  {t("Real app screens, shown as a simple flow: choose, cook, shop, scan, then reuse what is already in the fridge.")}
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
                    className={`landing-screenshot-card landing-proof-card landing-feature-card overflow-hidden rounded-2xl border border-primary/10 bg-background shadow-[0_18px_42px_rgba(0,0,0,0.08)] ${
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
                        {t(screenshot.title)}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-text/65">
                        {t(screenshot.body)}
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
