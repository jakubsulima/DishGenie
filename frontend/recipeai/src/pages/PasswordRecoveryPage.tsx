import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ErrorAlert from "../components/ErrorAlert";
import { useLanguage } from "../context/languageContext";
import { apiClient } from "../lib/hooks";

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,128}$/;

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const { locale, t } = useLanguage();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await apiClient("forgot-password", true, { email, locale });
      setIsSent(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("Could not request a password reset. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-start justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-primary/10 bg-background p-6 shadow-[0_24px_70px_rgba(0,0,0,0.08)] sm:p-8">
        <h1 className="text-3xl font-bold text-text">{t("Reset password")}</h1>
        <p className="mt-2 text-sm leading-6 text-text/60">
          {t("Enter your email and we will send a secure reset link.")}
        </p>
        {isSent ? (
          <div className="mt-6 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm leading-6 text-text">
            {t(
              "If an eligible account exists, a password reset link has been sent.",
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <ErrorAlert message={error ? t(error) : ""} autoHideMs={0} />
            <div>
              <label htmlFor="recovery-email" className="mb-1.5 block text-sm font-medium text-text">
                {t("Email")}
              </label>
              <input
                id="recovery-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-primary/15 bg-secondary/70 p-3 text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/45"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-accent py-3 font-bold text-primary disabled:opacity-50"
            >
              {t(isSubmitting ? "Sending..." : "Send reset link")}
            </button>
          </form>
        )}
        <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-accent hover:underline">
          {t("Back to sign in")}
        </Link>
      </section>
    </div>
  );
};

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { t } = useLanguage();
  const token = searchParams.get("token") ?? "";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError(t("This password reset link is invalid."));
      return;
    }
    if (!passwordPattern.test(password)) {
      setError(
        t(
          "Use at least 8 characters with uppercase, lowercase, number, and special character.",
        ),
      );
      return;
    }
    if (password !== confirmPassword) {
      setError(t("Passwords must match"));
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      await apiClient("reset-password", true, { token, password });
      setIsComplete(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("This password reset link is invalid or expired."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-start justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-primary/10 bg-background p-6 shadow-[0_24px_70px_rgba(0,0,0,0.08)] sm:p-8">
        <h1 className="text-3xl font-bold text-text">{t("Choose a new password")}</h1>
        {isComplete ? (
          <div className="mt-6">
            <p className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm text-text">
              {t("Your password has been updated.")}
            </p>
            <Link to="/login" className="mt-5 inline-block font-semibold text-accent hover:underline">
              {t("Sign in")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <ErrorAlert message={error ? t(error) : ""} autoHideMs={0} />
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-text">
                {t("New password")}
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-primary/15 bg-secondary/70 p-3 text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/45"
              />
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="mb-1.5 block text-sm font-medium text-text">
                {t("Confirm password")}
              </label>
              <input
                id="confirm-new-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-2xl border border-primary/15 bg-secondary/70 p-3 text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/45"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-accent py-3 font-bold text-primary disabled:opacity-50"
            >
              {t(isSubmitting ? "Saving..." : "Save new password")}
            </button>
          </form>
        )}
      </section>
    </div>
  );
};
