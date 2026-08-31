import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/languageContext";

interface OptionItem {
  value: string;
  label: string;
  description?: string;
}

interface OptionsFormProps {
  name: string;
  options: string[];
  displayOptions?: string[];
  richOptions?: OptionItem[];
  variant?: "select" | "cards";
  enableCardPaging?: boolean;
  cardsPerPage?: number;
  expandableCards?: boolean;
  initialVisibleCount?: number;
  showOkBadge?: boolean;
  currentOptions: string;
  onSaveOptions?: (options: string) => void;
  children?: React.ReactNode;
  classname?: string;
  onChange?: (value: string) => void;
  showSubmitButton?: boolean;
  buttonText?: string;
  label?: string;
}

const OptionsForm = ({
  name,
  options,
  displayOptions,
  richOptions,
  variant = "select",
  enableCardPaging = false,
  cardsPerPage = 4,
  expandableCards = false,
  initialVisibleCount = 6,
  showOkBadge = false,
  currentOptions,
  onSaveOptions,
  onChange,
  classname,
  showSubmitButton = false,
  buttonText = "Save",
  label,
}: OptionsFormProps) => {
  const { t } = useLanguage();
  const [selectedOption, setSelectedOption] = useState(currentOptions);
  const [showAllCardOptions, setShowAllCardOptions] = useState(false);
  const [cardPage, setCardPage] = useState(0);

  const optionItems = useMemo<OptionItem[]>(() => {
    if (richOptions && richOptions.length > 0) {
      return richOptions;
    }

    const optionsToDisplay = displayOptions || options;
    return options.map((option, index) => ({
      value: option,
      label: optionsToDisplay[index] ?? option,
    }));
  }, [richOptions, displayOptions, options]);

  useEffect(() => {
    setSelectedOption(currentOptions);
  }, [currentOptions]);

  const resolvedInitialVisibleCount = Math.max(1, initialVisibleCount);
  const resolvedCardsPerPage = Math.max(1, cardsPerPage);
  const canPageCards =
    variant === "cards" &&
    enableCardPaging &&
    optionItems.length > resolvedCardsPerPage;
  const canExpandCards =
    variant === "cards" &&
    expandableCards &&
    !canPageCards &&
    optionItems.length > resolvedInitialVisibleCount;

  const totalPages = Math.max(
    1,
    Math.ceil(optionItems.length / resolvedCardsPerPage),
  );

  useEffect(() => {
    if (!canExpandCards) {
      setShowAllCardOptions(false);
    }
  }, [canExpandCards]);

  useEffect(() => {
    if (!canPageCards) {
      setCardPage(0);
      return;
    }

    setCardPage((prevPage) => Math.min(prevPage, totalPages - 1));
  }, [canPageCards, totalPages]);

  useEffect(() => {
    if (!canPageCards || !selectedOption) {
      return;
    }

    const selectedIndex = optionItems.findIndex(
      (option) => option.value === selectedOption,
    );
    if (selectedIndex < 0) {
      return;
    }

    const selectedPage = Math.floor(selectedIndex / resolvedCardsPerPage);
    setCardPage((prevPage) =>
      prevPage === selectedPage ? prevPage : selectedPage,
    );
  }, [canPageCards, optionItems, selectedOption, resolvedCardsPerPage]);

  const visibleOptionItems = canPageCards
    ? optionItems.slice(
        cardPage * resolvedCardsPerPage,
        (cardPage + 1) * resolvedCardsPerPage,
      )
    : canExpandCards && !showAllCardOptions
      ? optionItems.slice(0, resolvedInitialVisibleCount)
      : optionItems;

  const handleSelectChange = (value: string) => {
    setSelectedOption(value);
    if (onChange) {
      onChange(value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSaveOptions && selectedOption) {
      onSaveOptions(selectedOption);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-col gap-2 ${classname || ""}`}
    >
      {label && (
        <label className="block text-sm font-medium text-text">{t(label)}</label>
      )}

      {variant === "cards" ? (
        <>
          <div
            className="grid gap-2 sm:grid-cols-2"
            role="radiogroup"
            aria-label={t(label || name)}
          >
            {visibleOptionItems.map((option) => {
              const isSelected = selectedOption === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectChange(option.value)}
                  className={`rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-accent/60 ${
                    isSelected
                      ? "border-accent bg-[linear-gradient(120deg,rgba(255,212,60,0.14),rgba(255,212,60,0.04))] shadow-[0_10px_24px_rgba(255,212,60,0.16)]"
                      : "border-primary/20 bg-secondary hover:border-accent/45 hover:bg-background"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text">
                          {t(option.label)}
                        </p>
                        {showOkBadge && isSelected && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                            {t("Selected")}
                          </span>
                        )}
                      </div>
                      {option.description && (
                        <p className="mt-1 text-xs text-text/70">
                          {t(option.description)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
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

          {canPageCards && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCardPage((prev) => Math.max(0, prev - 1))}
                disabled={cardPage === 0}
                className="rounded-md border border-primary/20 bg-secondary px-3 py-1.5 text-sm font-semibold text-text transition-colors hover:border-accent/45 hover:bg-background disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t("Previous")}
              </button>

              <p className="text-xs font-medium uppercase tracking-wide text-text/60">
                {t("Page {current} of {total}", {
                  current: cardPage + 1,
                  total: totalPages,
                })}
              </p>

              <button
                type="button"
                onClick={() =>
                  setCardPage((prev) => Math.min(totalPages - 1, prev + 1))
                }
                disabled={cardPage >= totalPages - 1}
                className="rounded-md border border-primary/20 bg-secondary px-3 py-1.5 text-sm font-semibold text-text transition-colors hover:border-accent/45 hover:bg-background disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t("Next")}
              </button>
            </div>
          )}

          {canExpandCards && (
            <button
              type="button"
              onClick={() => setShowAllCardOptions((prev) => !prev)}
              className="mt-1 w-fit self-start rounded-md px-1 py-1 text-sm font-semibold text-accent transition-colors hover:text-accent/80 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {showAllCardOptions
                ? t("Show fewer options")
                : t("Show {count} more options", {
                    count: optionItems.length - resolvedInitialVisibleCount,
                  })}
            </button>
          )}
        </>
      ) : (
        <div className="relative">
          <select
            name={name}
            value={selectedOption}
            onChange={(e) => handleSelectChange(e.target.value)}
            className="w-full appearance-none rounded-lg border border-primary/20 bg-background px-3 py-2.5 pr-10 text-text shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">{t(currentOptions ? "None" : "Select...")}</option>
            {optionItems.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-text/50">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      )}

      {showSubmitButton && (
        <button
          type="submit"
          disabled={selectedOption === currentOptions}
          className="mt-2 w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-text shadow-sm transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t(buttonText)}
        </button>
      )}
    </form>
  );
};

export default OptionsForm;
