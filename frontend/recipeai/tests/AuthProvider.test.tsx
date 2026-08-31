import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthProvider, useUser } from "../src/context/context";
import { apiClient, ensureCsrfToken } from "../src/lib/hooks";

vi.mock("../src/lib/hooks", () => ({
  apiClient: vi.fn(),
  ensureCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

const AuthProbe = () => {
  const { user, loading } = useUser();

  return (
    <div>
      <span>{loading ? "loading" : "loaded"}</span>
      <span>{user?.email ?? "anonymous"}</span>
    </div>
  );
};

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(ensureCsrfToken).mockResolvedValue(undefined);
  });

  test("does not probe the current session without the local storage hint", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      email: "session@example.com",
      id: 42,
      role: "USER",
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(ensureCsrfToken).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText("loaded")).toBeInTheDocument();
    });
    expect(apiClient).not.toHaveBeenCalled();
    expect(screen.getByText("anonymous")).toBeInTheDocument();
  });

  test("refreshes once after a 401 before restoring the session", async () => {
    localStorage.setItem("isLoggedIn", "true");
    vi.mocked(apiClient).mockImplementation(
      async (url: string, uploadData?: boolean) => {
        if (url === "me" && !uploadData) {
          if (
            vi.mocked(apiClient).mock.calls.filter(
              ([calledUrl]) => calledUrl === "me",
            ).length === 1
          ) {
            throw { status: 401 };
          }

          return {
            email: "recovered@example.com",
            id: 8,
            role: "USER",
          };
        }

        if (url === "refresh") {
          return {};
        }

        throw new Error(`Unexpected API call: ${url}`);
      },
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("recovered@example.com")).toBeInTheDocument();
    expect(apiClient).toHaveBeenCalledWith("refresh", true);
  });
});
