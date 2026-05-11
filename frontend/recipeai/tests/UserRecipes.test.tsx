import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Recipes from "../src/pages/UserRecipes";
import { apiClient } from "../src/lib/hooks";
import { useUser } from "../src/context/context";

vi.mock("../src/lib/hooks", () => ({
  apiClient: vi.fn(),
}));

vi.mock("../src/context/context", () => ({
  useUser: vi.fn(),
}));

describe("UserRecipes search flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useUser).mockReturnValue({
      user: { id: 3, role: "USER" },
      loading: false,
    } as ReturnType<typeof useUser>);

    vi.mocked(apiClient).mockImplementation(async (url: string) => {
      if (url.startsWith("getUserRecipes/3?page=0")) {
        return {
          content: [{ id: "1", name: "Saved recipe", timeToPrepare: "10 min" }],
          totalPages: 1,
        };
      }

      if (url === "searchRecipes/pasta?page=0&size=9") {
        return {
          content: [{ id: "9", name: "Pasta soup", timeToPrepare: "20 min" }],
          totalPages: 2,
        };
      }

      if (url === "searchRecipes/pasta?page=1&size=9") {
        return {
          content: [{ id: "10", name: "Pasta bake", timeToPrepare: "30 min" }],
          totalPages: 2,
        };
      }

      throw new Error(`Unexpected API call: ${url}`);
    });
  });

  test("does not search on each keystroke and only searches on submit", async () => {
    render(
      <MemoryRouter>
        <Recipes />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Saved recipe")).toBeInTheDocument();
    vi.mocked(apiClient).mockClear();

    fireEvent.change(screen.getByPlaceholderText("Search recipes by name..."), {
      target: { value: "pasta" },
    });

    await waitFor(() => {
      expect(apiClient).not.toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        "searchRecipes/pasta?page=0&size=9",
        false,
      );
    });
    expect(await screen.findByText("Pasta soup")).toBeInTheDocument();
  });

  test("reuses the submitted term when paginating search results", async () => {
    render(
      <MemoryRouter>
        <Recipes />
      </MemoryRouter>,
    );

    await screen.findByText("Saved recipe");

    fireEvent.change(screen.getByPlaceholderText("Search recipes by name..."), {
      target: { value: "pasta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Pasta soup")).toBeInTheDocument();
    vi.mocked(apiClient).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        "searchRecipes/pasta?page=1&size=9",
        false,
      );
    });
    expect(await screen.findByText("Pasta bake")).toBeInTheDocument();
  });
});
