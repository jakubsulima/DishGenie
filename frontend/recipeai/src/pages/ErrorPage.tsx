import { useEffect } from "react";
import {
  isRouteErrorResponse,
  useLocation,
  useRouteError,
} from "react-router-dom";
import { applySeo } from "../lib/seo";

interface ErrorPageProps {
  title?: string;
  subtitle?: string;
}

const ErrorPage = ({
  title = "Something went wrong",
  subtitle = "An unexpected error occurred. Please try again.",
}: ErrorPageProps) => {
  const routeError = useRouteError();
  const location = useLocation();

  const isNotFound =
    isRouteErrorResponse(routeError) && routeError.status === 404;

  const finalTitle = isNotFound ? "Page not found" : title;
  const finalSubtitle = isNotFound
    ? "The page you requested does not exist."
    : subtitle;

  useEffect(() => {
    applySeo({
      title: finalTitle,
      description: finalSubtitle,
      canonicalPath: location.pathname,
      noindex: true,
    });
  }, [finalSubtitle, finalTitle, location.pathname]);

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-primary/15 bg-secondary p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-text">{finalTitle}</h1>
        <p className="mt-3 text-sm text-text/65">{finalSubtitle}</p>
        <a
          href="/"
          className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-accent/90"
        >
          Back to home
        </a>
      </div>
    </div>
  );
};

export default ErrorPage;
