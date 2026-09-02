import { describe, expect, test } from "vitest";
import { sanitizeAnalyticsProperties } from "../src/lib/posthog";

describe("analytics contract", () => {
  test("removes sensitive and user-content properties", () => {
    expect(
      sanitizeAnalyticsProperties({
        planId: "safe-id",
        prompt: "private request",
        requestText: "private request",
        fridgeItems: ["milk"],
        ingredients: ["flour"],
        diets: ["VEGAN"],
        dislikedIngredients: ["mushrooms"],
        email: "cook@example.com",
      }),
    ).toEqual({ planId: "safe-id" });
  });
});
