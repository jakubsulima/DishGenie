import posthog from "posthog-js";
import type { UserProps } from "../context/context";
import {
  getPostHogApiHost,
  getPostHogKey,
  getPostHogUiHost,
  isPostHogConfigured,
} from "./runtimeConfig";

type AnalyticsEventName =
  | "$pageview"
  | "marketing_cta_click"
  | "auth_login_success"
  | "auth_signup_success"
  | "recipe_generation_requested"
  | "recipe_generation_succeeded"
  | "recipe_generation_failed"
  | "recipe_saved"
  | "shopping_list_generated"
  | "fridge_item_added"
  | "fridge_item_added_barcode"
  | "fridge_items_added_receipt"
  | "planner_opened"
  | "meal_plan_generation_requested"
  | "meal_plan_generation_completed"
  | "meal_plan_slot_swapped"
  | "meal_plan_slot_locked"
  | "meal_plan_accepted"
  | "meal_plan_shopping_list_created"
  | "meal_plan_slot_cooked"
  | "meal_plan_slot_skipped";

type AnalyticsProperties = Record<string, unknown>;

const FORBIDDEN_ANALYTICS_PROPERTIES = new Set([
  "prompt",
  "requestText",
  "fridgeItems",
  "ingredients",
  "diets",
  "dislikedIngredients",
  "email",
]);

export const sanitizeAnalyticsProperties = (
  properties: AnalyticsProperties,
): AnalyticsProperties =>
  Object.fromEntries(
    Object.entries(properties).filter(
      ([key]) => !FORBIDDEN_ANALYTICS_PROPERTIES.has(key),
    ),
  );

let posthogInitialized = false;

const canCapture = (): boolean =>
  posthogInitialized && !posthog.has_opted_out_capturing();

export const initializePostHog = (): boolean => {
  if (!isPostHogConfigured()) {
    return false;
  }

  if (posthogInitialized) {
    posthog.opt_in_capturing();
    return true;
  }

  posthog.init(getPostHogKey(), {
    api_host: getPostHogApiHost(),
    ui_host: getPostHogUiHost(),
    defaults: "2026-01-30",
    autocapture: false,
    capture_pageview: false,
    persistence: "localStorage+cookie",
  });

  posthogInitialized = true;
  posthog.opt_in_capturing();
  return true;
};

export const disablePostHog = () => {
  if (!posthogInitialized) {
    return;
  }

  posthog.opt_out_capturing();
  posthog.reset();
};

export const captureEvent = (
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {},
) => {
  if (!canCapture()) {
    return;
  }

  posthog.capture(eventName, {
    captureSource: "frontend",
    ...sanitizeAnalyticsProperties(properties),
  });
};

export const capturePageView = () => {
  if (!canCapture()) {
    return;
  }

  captureEvent("$pageview", {
    $current_url: window.location.href,
    $pathname: window.location.pathname,
    $page_title: document.title,
  });
};

export const identifyAnalyticsUser = (user: UserProps) => {
  if (!canCapture()) {
    return;
  }

  posthog.identify(String(user.id), {
    email: user.email,
    role: user.role,
    subscriptionPlan: user.subscriptionPlan ?? "FREE",
  });
};

export const resetAnalyticsUser = () => {
  if (!posthogInitialized) {
    return;
  }

  posthog.reset();
};
