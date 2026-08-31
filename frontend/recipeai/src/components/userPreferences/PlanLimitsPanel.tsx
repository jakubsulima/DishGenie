import { useState } from "react";
import { useLanguage } from "../../context/languageContext";

interface PlanLimitsPanelProps {
  accountPlan: string;
  hasUnlimitedRecipes: boolean;
  recipeCreationLimit: number;
  recipesRemaining: number | null | undefined;
  recipeCreationLimitReached?: boolean;
}

const PlanLimitsPanel = ({
  accountPlan,
  hasUnlimitedRecipes,
  recipeCreationLimit,
  recipesRemaining,
  recipeCreationLimitReached,
}: PlanLimitsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="mobile-card-enter mb-6 rounded-xl border border-primary/10 bg-background p-4">
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={isOpen}
        aria-controls="plan-limits-content"
      >
        <div>
          <h2 className="mb-1 text-xl font-semibold text-text">
            {t("Generation Request Limit")}
          </h2>
          <p className="text-sm text-text/60">
            {t("Your account plan controls how many recipe generation requests you can make per day.")}
          </p>
        </div>
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-secondary text-text transition-transform duration-300 ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
          aria-hidden="true"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div id="plan-limits-content" className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-primary/10 bg-secondary p-3">
              <p className="text-xs uppercase tracking-wide text-text/60">
                {t("Current plan")}
              </p>
              <p className="mt-1 text-base font-semibold text-text">
                {accountPlan}
              </p>
            </div>
            <div className="rounded-lg border border-primary/10 bg-secondary p-3">
              <p className="text-xs uppercase tracking-wide text-text/60">
                {t("Generation request limit")}
              </p>
              <p className="mt-1 text-base font-semibold text-text">
                {hasUnlimitedRecipes ? t("Unlimited") : recipeCreationLimit}
              </p>
            </div>
            <div className="rounded-lg border border-primary/10 bg-secondary p-3">
              <p className="text-xs uppercase tracking-wide text-text/60">
                {t("Remaining today")}
              </p>
              <p className="mt-1 text-base font-semibold text-text">
                {hasUnlimitedRecipes ? t("Unlimited") : (recipesRemaining ?? 0)}
              </p>
            </div>
          </div>
          {!hasUnlimitedRecipes && recipeCreationLimitReached && (
            <p className="rounded-lg border border-accent/45 bg-accent/10 px-3 py-2 text-sm text-text">
              {t("You reached your daily request limit. Try again tomorrow or upgrade your plan.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PlanLimitsPanel;
