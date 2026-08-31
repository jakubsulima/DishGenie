import { useLanguage } from "../context/languageContext";

interface FoodLoadingScreenProps {
  title?: string;
  subtitle?: string;
  fullScreen?: boolean;
  variant?: "default" | "generating";
  compact?: boolean;
}

const FoodLoadingScreen = ({
  title = "Loading...",
  subtitle = "Please wait a moment",
  fullScreen = true,
  variant = "default",
  compact = false,
}: FoodLoadingScreenProps) => {
  const { t } = useLanguage();
  const wrapperClasses = fullScreen
    ? "min-h-screen bg-background"
    : compact
      ? "min-h-[16rem]"
      : "min-h-[24rem]";

  return (
    <div
      className={`w-full ${wrapperClasses} flex items-center justify-center px-4 py-8`}
    >
      <div className="relative flex flex-col items-center justify-start text-center max-w-md pt-12">
        {/* Main visual anchor so animations orbit correctly */}
        <div className="relative flex h-36 w-36 items-center justify-center mb-8">
          <div className="food-loader-ring" aria-hidden="true"></div>

          <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-secondary/80 food-loader-icon-shadow">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 64 64"
              className="h-12 w-12 text-primary food-loader-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              aria-hidden="true"
            >
              <ellipse cx="32" cy="39" rx="18" ry="8" />
              <path d="M14 20h36" />
              <path d="M20 13c0 6 3 9 3 9" strokeLinecap="round" />
              <path d="M30 11c0 8 3 11 3 11" strokeLinecap="round" />
              <path d="M40 13c0 6 3 9 3 9" strokeLinecap="round" />
            </svg>
          </div>

          <span
            className="food-loader-orbit food-loader-orbit-1"
            aria-hidden="true"
          >
            <span className="food-loader-orbit-dot" />
          </span>
          <span
            className="food-loader-orbit food-loader-orbit-2"
            aria-hidden="true"
          >
            <span className="food-loader-orbit-dot" />
          </span>
          <span
            className="food-loader-orbit food-loader-orbit-3"
            aria-hidden="true"
          >
            <span className="food-loader-orbit-dot" />
          </span>
        </div>

        <h2 className="mt-2 text-xl font-semibold text-text">{t(title)}</h2>
        <p className="mt-2 text-sm text-text/65">{t(subtitle)}</p>

        {variant === "generating" && (
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-text/75 h-8">
            <span className="food-loader-chip">{t("Marinating ideas")}</span>
            <span className="food-loader-chip">{t("Balancing flavors")}</span>
            <span className="food-loader-chip">{t("Plating the result")}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodLoadingScreen;
