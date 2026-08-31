import { useEffect } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import AnalyticsConsentBanner from "../components/AnalyticsConsentBanner";
import { useAnalyticsConsent } from "../context/analyticsConsentContext";
import { capturePageView } from "../lib/posthog";
import { applySeo, getSeoConfig } from "../lib/seo";
import { useLanguage } from "../context/languageContext";

const Layout = () => {
  const location = useLocation();
  const { consentStatus } = useAnalyticsConsent();
  const { locale } = useLanguage();

  useEffect(() => {
    applySeo(getSeoConfig(location.pathname, locale));
  }, [location.pathname, locale]);

  useEffect(() => {
    if (consentStatus !== "granted") {
      return;
    }

    capturePageView();
  }, [consentStatus, location.pathname, location.search]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background pt-16">
      <ScrollRestoration />
      <Navbar />
      <main key={location.pathname} className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AnalyticsConsentBanner />
    </div>
  );
};

export default Layout;
