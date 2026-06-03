import { useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "../lib/hooks";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useUser, type UserProps } from "../context/context";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ErrorAlert from "../components/ErrorAlert";
import { captureEvent } from "../lib/posthog";
import {
  clearPendingRecipeSearch,
  consumePendingRecipeRedirect,
  readPendingRecipeSearch,
} from "../lib/pendingRecipeIntent";
import { getGoogleClientId } from "../lib/runtimeConfig";
import {
  getGsiState,
  loadGoogleIdentityScript,
  type GoogleCredentialResponse,
} from "../lib/googleIdentity";
import homepageIcon160 from "../assets/dish-genie-homepage-icon-160.webp";

interface LoginProps {
  email: string;
  password: string;
}

interface AuthRedirectTarget {
  pathname: string;
  search?: string;
  state?: unknown;
}

const resolveAuthRedirectTarget = (value: unknown): AuthRedirectTarget | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const from = (value as { from?: unknown }).from;
  if (!from || typeof from !== "object") {
    return null;
  }

  const pathname = (from as { pathname?: unknown }).pathname;
  if (typeof pathname !== "string" || pathname.trim() === "") {
    return null;
  }

  const search = (from as { search?: unknown }).search;
  const state = (from as { state?: unknown }).state;

  return {
    pathname,
    search: typeof search === "string" ? search : "",
    state,
  };
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
};

const GOOGLE_SIGN_IN_ERROR_MESSAGE = "Google sign-in failed. Please try again.";

const schema = yup.object({
  email: yup.string().required("Email is required"),
  password: yup.string().required("Password is required"),
});

const Login = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleButtonReady, setIsGoogleButtonReady] = useState(false);
  const [error, setError] = useState("");
  const { user, loading: authLoading, setUser, refreshSession } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const isHandlingAuthSuccessRef = useRef(false);
  const pendingRecipeSearch = readPendingRecipeSearch(location.state);

  // Redirect already-logged-in users
  useEffect(() => {
    if (!authLoading && user && !isHandlingAuthSuccessRef.current) {
      const redirectTarget =
        resolveAuthRedirectTarget(location.state) ?? consumePendingRecipeRedirect();

      if (redirectTarget) {
        navigate(
          {
            pathname: redirectTarget.pathname,
            search: redirectTarget.search,
          },
          { replace: true, state: redirectTarget.state },
        );
        return;
      }

      navigate("/", { replace: true });
    }
  }, [user, authLoading, location.state, navigate]);

  const handleAuthSuccess = useCallback(
    (userData: UserProps, method: "credentials" | "google") => {
      captureEvent("auth_login_success", {
        method,
      });

      isHandlingAuthSuccessRef.current = true;
      const redirectTarget =
        resolveAuthRedirectTarget(location.state) ?? consumePendingRecipeRedirect();
      localStorage.setItem("isLoggedIn", "true");
      setUser(userData);
      refreshSession().catch(() => {
        // Route guards will handle unauthenticated fallback if session sync fails.
      });
      if (redirectTarget) {
        clearPendingRecipeSearch();
        navigate(
          {
            pathname: redirectTarget.pathname,
            search: redirectTarget.search,
          },
          { replace: true, state: redirectTarget.state },
        );
        return;
      }

      navigate("/", { replace: true });
    },
    [location.state, setUser, refreshSession, navigate],
  );

  // Google OAuth callback
  const handleGoogleCallback = useCallback(
    async (response: GoogleCredentialResponse) => {
      setIsSubmitting(true);
      setError("");
      try {
        const userData = await apiClient<UserProps>("oauth/google", true, {
          idToken: response.credential,
          acceptedTerms: true,
          acceptedPrivacy: true,
        });
        handleAuthSuccess(userData, "google");
      } catch (error: unknown) {
        setError(getErrorMessage(error, GOOGLE_SIGN_IN_ERROR_MESSAGE));
      } finally {
        setIsSubmitting(false);
      }
    },
    [handleAuthSuccess],
  );

  // Initialize Google Sign-In button
  useEffect(() => {
    let isMounted = true;

    const initGoogle = () => {
      if (isMounted && window.google?.accounts?.id && googleBtnRef.current) {
        const clientId = getGoogleClientId();
        if (!clientId) {
          setIsGoogleButtonReady(true);
          return;
        }

        const gsiState = getGsiState();
        gsiState.callback = handleGoogleCallback;

        if (!gsiState.initialized || gsiState.clientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: GoogleCredentialResponse) => {
              const activeCallback = getGsiState().callback;
              if (activeCallback) {
                activeCallback(response);
              }
            },
          });
          gsiState.initialized = true;
          gsiState.clientId = clientId;
        }

        setIsGoogleButtonReady(false);
        googleBtnRef.current.innerHTML = "";
        const buttonWidth = Math.floor(
          Math.min(
            380,
            Math.max(
              280,
              googleBtnRef.current.getBoundingClientRect().width - 20,
            ),
          ),
        );
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          logo_alignment: "left",
          width: buttonWidth,
          locale: "en",
        });

        window.requestAnimationFrame(() => {
          if (isMounted) {
            setIsGoogleButtonReady(true);
          }
        });
      }
    };

    loadGoogleIdentityScript()
      .then(initGoogle)
      .catch(() => {
        if (isMounted) {
          setError(GOOGLE_SIGN_IN_ERROR_MESSAGE);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [handleGoogleCallback]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginProps>({
    resolver: yupResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginProps) => {
    setIsSubmitting(true);
    setError("");
    try {
      const userData = await apiClient<UserProps>("login", true, data);
      handleAuthSuccess(userData, "credentials");
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Login failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-9rem)] w-full items-start justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-[-12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,_color-mix(in_srgb,var(--color-accent)_38%,transparent)_0%,transparent_72%)] blur-2xl" />
        <div className="absolute right-[-12%] top-1/3 h-80 w-80 rounded-full bg-[radial-gradient(circle,_color-mix(in_srgb,var(--color-primary)_10%,transparent)_0%,transparent_72%)] blur-3xl" />
      </div>
      <div className="flex flex-col items-center w-full max-w-md animate-fadeIn">
        {/* Header */}
        <div className="relative z-10 mb-7 text-center">
          <img
            src={homepageIcon160}
            alt=""
            aria-hidden="true"
            className="mx-auto mb-3 h-16 w-16 object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.08)]"
          />
          <h1 className="text-3xl font-bold text-text">Welcome back</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-text/55">
            Your saved recipes, fridge, and dinner ideas are waiting.
          </p>
        </div>

        {/* Card */}
        <div className="mobile-card-enter relative z-10 w-full rounded-3xl border border-primary/10 bg-background/90 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:p-8">
          {pendingRecipeSearch && (
            <div className="mb-5 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-left">
              <p className="text-sm font-bold text-text">
                Your dinner idea is saved.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text/65">
                Sign in and Dish Genie will generate it without asking you to
                type or choose everything again.
              </p>
              <p className="mt-2 line-clamp-2 text-xs font-semibold text-text/60">
                {pendingRecipeSearch}
              </p>
            </div>
          )}
          <ErrorAlert
            message={error}
            className="mb-6"
            onAutoHide={() => setError("")}
          />

          {/* Google Sign-In (rendered by Google SDK) */}
          <div className="mb-6 w-full">
            <div className="relative mx-auto h-11 w-full max-w-[400px]">
              {!isGoogleButtonReady && (
                <div className="absolute inset-0 flex animate-pulse items-center justify-center gap-3 rounded-full border border-primary/10 bg-secondary/70 text-sm font-semibold text-text/60 shadow-sm">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-background text-sm font-bold text-[#4285f4] shadow-sm">
                    G
                  </span>
                  <span>Continue with Google</span>
                </div>
              )}
              <div
                ref={googleBtnRef}
                className={`absolute inset-0 flex h-11 w-full justify-center transition-opacity duration-200 [&>div]:!mx-auto [&_iframe]:!rounded-full ${
                  isGoogleButtonReady ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
            <p className="mt-3 text-center text-xs leading-5 text-text/50">
              If this creates a new account, you agree to the{" "}
              <Link
                to="/terms"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-text hover:text-accent"
              >
                Terms
              </Link>{" "}
              and acknowledge the{" "}
              <Link
                to="/privacy"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-text hover:text-accent"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-primary/10" />
            <span className="text-text/40 text-sm font-medium">or</span>
            <div className="flex-1 h-px bg-primary/10" />
          </div>

          {/* Email/Password Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div>
              <label
                htmlFor="email"
                className="text-text text-sm font-medium block mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                {...register("email")}
                className="w-full rounded-2xl border border-primary/15 bg-secondary/70 p-3 text-text transition-all placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/45"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="password"
                className="text-text text-sm font-medium block mb-1.5"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                {...register("password")}
                className="w-full rounded-2xl border border-primary/15 bg-secondary/70 p-3 text-text transition-all placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/45"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mobile-soft-press mt-2 cursor-pointer rounded-full bg-accent py-3 font-semibold text-primary shadow-[0_14px_28px_color-mix(in_srgb,var(--color-accent)_36%,transparent)] transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="relative z-10 mt-6 text-sm text-text/50">
          Don't have an account?{" "}
          <button
            onClick={() => navigate("/register", { state: location.state })}
            className="mobile-soft-press text-accent font-semibold hover:underline cursor-pointer"
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
