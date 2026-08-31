import { useEffect, useMemo, useState } from "react";
import { DietGroupId, DietOptionGroup } from "../../lib/dietOptions";
import { useLanguage } from "../../context/languageContext";

interface DietaryPlanPanelProps {
  dietGroups: DietOptionGroup[];
  selectedDiets: string[];
  dietSaving: boolean;
  onToggleDiet: (dietValue: string) => void;
}

const DIET_CARDS_PER_SLIDE = 3;

const DietaryPlanPanel = ({
  dietGroups,
  selectedDiets,
  dietSaving,
  onToggleDiet,
}: DietaryPlanPanelProps) => {
  const [activeDietGroup, setActiveDietGroup] =
    useState<DietGroupId>("general");
  const [activeDietSlide, setActiveDietSlide] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    if (dietGroups.length === 0) {
      return;
    }

    const groupExists = dietGroups.some(
      (group) => group.id === activeDietGroup,
    );
    if (!groupExists) {
      setActiveDietGroup(dietGroups[0].id);
      setActiveDietSlide(0);
    }
  }, [activeDietGroup, dietGroups]);

  const currentGroup = useMemo(
    () =>
      dietGroups.find((group) => group.id === activeDietGroup) ??
      dietGroups[0] ??
      null,
    [activeDietGroup, dietGroups],
  );

  const totalSlides = useMemo(
    () =>
      currentGroup
        ? Math.max(
            1,
            Math.ceil(currentGroup.options.length / DIET_CARDS_PER_SLIDE),
          )
        : 1,
    [currentGroup],
  );

  useEffect(() => {
    setActiveDietSlide((previous) => Math.min(previous, totalSlides - 1));
  }, [totalSlides]);

  const visibleDietOptions = useMemo(
    () =>
      currentGroup
        ? currentGroup.options.slice(
            activeDietSlide * DIET_CARDS_PER_SLIDE,
            (activeDietSlide + 1) * DIET_CARDS_PER_SLIDE,
          )
        : [],
    [activeDietSlide, currentGroup],
  );

  return (
    <div className="mobile-card-enter mobile-card-delay-1 mb-6 rounded-xl border border-primary/10 bg-background p-4">
      <h2 className="mb-1 text-xl font-semibold text-text">{t("Dietary Plan")}</h2>
      <p className="mb-3 text-sm text-text/60">
        {t("Combine styles and restrictions. Your choices sync instantly.")}
      </p>

      {dietGroups.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {dietGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setActiveDietGroup(group.id);
                  setActiveDietSlide(0);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                  group.id === activeDietGroup
                    ? "bg-accent text-primary shadow-[0_8px_18px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]"
                    : "border border-primary/20 bg-secondary text-text/75 hover:border-accent/45 hover:bg-background"
                }`}
              >
                {t(group.label)}
              </button>
            ))}
          </div>

          {currentGroup && (
            <p className="rounded-lg border border-primary/10 bg-secondary px-3 py-2 text-xs text-text/70">
              {t(currentGroup.helperText)}
            </p>
          )}

          <div
            className="space-y-2"
            role="group"
            aria-label={t("Dietary plan options")}
          >
            <div
              key={`diet-slide-${activeDietGroup}-${activeDietSlide}`}
              className="diet-slide-enter space-y-2"
            >
              {visibleDietOptions.map((option) => {
                const isSelected = selectedDiets.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => onToggleDiet(option.value)}
                    disabled={dietSaving}
                    className={`w-full rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-accent/60 ${
                      isSelected
                        ? "border-accent bg-[linear-gradient(120deg,rgba(255,212,60,0.14),rgba(255,212,60,0.04))]"
                        : "border-primary/20 bg-secondary hover:border-accent/45 hover:bg-background"
                    } ${dietSaving ? "cursor-wait" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text">
                          {t(option.label)}
                        </p>
                        <p className="mt-1 text-xs text-text/70">
                          {t(option.description)}
                        </p>
                      </div>
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                          isSelected
                            ? "border-accent bg-accent text-primary"
                            : "border-primary/35 bg-background"
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected && (
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {currentGroup && totalSlides > 1 && (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDietSlide((previous) =>
                        Math.max(0, previous - 1),
                      )
                    }
                    disabled={activeDietSlide === 0}
                    className="flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-sm font-medium text-text transition-all duration-300 hover:bg-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-secondary"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    <span className="ml-1">{t("Prev")}</span>
                  </button>

                  <div className="flex items-center justify-center gap-1.5">
                    {Array.from({ length: totalSlides }).map((_, dotIndex) => (
                      <span
                        key={`diet-slide-dot-${dotIndex}`}
                        className={`h-2 rounded-full transition-all ${
                          dotIndex === activeDietSlide
                            ? "w-6 bg-accent"
                            : "w-2 bg-primary/20"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveDietSlide((previous) =>
                        Math.min(totalSlides - 1, previous + 1),
                      )
                    }
                    disabled={activeDietSlide >= totalSlides - 1}
                    className="flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-sm font-medium text-text transition-all duration-300 hover:bg-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-secondary"
                  >
                    <span className="mr-1">{t("Next")}</span>
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {dietSaving && (
              <p className="text-xs font-medium text-text/60">
                {t("Saving diet preferences...")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-primary/20 py-4 text-center text-sm text-text/70">
          No diet options available right now.
        </p>
      )}
    </div>
  );
};

export default DietaryPlanPanel;
