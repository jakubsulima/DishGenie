import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
  (
    window as Window & {
      __RECIPE_AI_RUNTIME_CONFIG__?: unknown;
    }
  ).__RECIPE_AI_RUNTIME_CONFIG__ = undefined;
  Object.defineProperty(window, "google", {
    configurable: true,
    writable: true,
    value: {
      accounts: {
        id: {
          initialize: vi.fn(),
          renderButton: vi.fn(),
        },
      },
    },
  });
});
