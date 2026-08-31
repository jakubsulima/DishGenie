import { useAnalyticsConsent } from "../context/analyticsConsentContext";
import { useLanguage } from "../context/languageContext";

const AnalyticsConsentBanner = () => {
  const {
    isAnalyticsAvailable,
    consentStatus,
    grantConsent,
    denyConsent,
    closeConsentSettings,
    isConsentSettingsOpen,
  } = useAnalyticsConsent();
  const { t } = useLanguage();

  const isFirstDecision = consentStatus === "unset";
  const isVisible = isFirstDecision || isConsentSettingsOpen;

  if (!isAnalyticsAvailable || !isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/15 bg-background/95 px-4 py-4 shadow-[0_-12px_32px_rgba(0,0,0,0.08)] backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 text-center">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-text">{t("Analytics settings")}</p>
          <p className="mt-1 text-sm text-text/70">
            {t("Dish Genie uses PostHog analytics through a first-party proxy domain to measure product usage and improve key flows. Analytics stays off until you opt in.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {!isFirstDecision && (
            <button
              type="button"
              onClick={closeConsentSettings}
              className="rounded-full border border-primary/20 px-4 py-2 text-sm font-medium text-text/70 transition-colors hover:bg-secondary"
            >
              {t("Close")}
            </button>
          )}
          <button
            type="button"
            onClick={denyConsent}
            className="rounded-full border border-primary/20 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-secondary"
          >
            {t("Reject analytics")}
          </button>
          <button
            type="button"
            onClick={grantConsent}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-accent/90"
          >
            {t("Accept analytics")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsConsentBanner;
