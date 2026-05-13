import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateRecipe } from "../src/lib/hooks";

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

    expect(axiosMock.post).toHaveBeenCalledTimes(1);

    resolveRequest?.({ data: { name: "Test Recipe" } });

    await expect(firstRequest).resolves.toEqual({ name: "Test Recipe" });
    await expect(secondRequest).resolves.toEqual({ name: "Test Recipe" });
  });
});
