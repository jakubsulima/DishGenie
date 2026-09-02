import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateRecipe, lookupProductByBarcode } from "../src/lib/hooks";

const { axiosMock } = vi.hoisted(() => ({
  axiosMock: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    isCancel: vi.fn(() => false),
    isAxiosError: vi.fn(() => false),
    defaults: {
      headers: {
        common: {} as Record<string, string>,
      },
      withCredentials: false,
    },
    interceptors: {
      response: {
        use: vi.fn(),
      },
    },
  },
}));

vi.mock("axios", () => ({
  default: axiosMock,
  ...axiosMock,
}));

describe("generateRecipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "XSRF-TOKEN=test-token; path=/";
  });

  it("deduplicates concurrent requests with the same prompt", async () => {
    let resolveRequest:
      | ((value: { data: { name: string } }) => void)
      | undefined;

    axiosMock.post.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const firstRequest = generateRecipe("test prompt", ["Onion", "Tomato"]);
    const secondRequest = generateRecipe("test prompt", ["Onion", "Tomato"]);

    await waitFor(() => {
      expect(axiosMock.post).toHaveBeenCalledTimes(1);
    });

    expect(axiosMock.post).toHaveBeenCalledWith(
      expect.stringContaining("generateRecipe"),
      {
        prompt: "test prompt",
        fridgeItems: ["Onion", "Tomato"],
        locale: "en",
        count: 1,
      },
      { signal: undefined },
    );

    resolveRequest?.({ data: { name: "Test Recipe" } });

    await expect(firstRequest).resolves.toEqual({ name: "Test Recipe" });
    await expect(secondRequest).resolves.toEqual({ name: "Test Recipe" });
  });

  it("does not share a request when the locale changes", async () => {
    const resolvers: Array<(value: { data: { name: string } }) => void> = [];
    axiosMock.post.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    document.documentElement.lang = "en";
    const englishRequest = generateRecipe("test prompt", ["Onion"]);
    document.documentElement.lang = "pl";
    const polishRequest = generateRecipe("test prompt", ["Onion"]);

    await waitFor(() => {
      expect(axiosMock.post).toHaveBeenCalledTimes(2);
    });

    resolvers.forEach((resolve) => resolve({ data: { name: "Test Recipe" } }));
    await expect(englishRequest).resolves.toEqual({ name: "Test Recipe" });
    await expect(polishRequest).resolves.toEqual({ name: "Test Recipe" });
  });
});

describe("lookupProductByBarcode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "XSRF-TOKEN=test-token; path=/";
  });

  it("treats an unknown barcode response as an empty product", async () => {
    axiosMock.isAxiosError.mockReturnValue(true);
    axiosMock.get.mockRejectedValue({
      response: { status: 404, data: {} },
      message: "Not found",
    });

    await expect(lookupProductByBarcode("0000000000000")).resolves.toBeNull();
  });

  it("keeps network failures distinguishable from an unknown barcode", async () => {
    axiosMock.isAxiosError.mockReturnValue(true);
    axiosMock.get.mockRejectedValue({
      request: {},
      message: "Network unavailable",
    });

    await expect(lookupProductByBarcode("5901234123457")).rejects.toMatchObject({
      isNetworkError: true,
    });
  });
});
