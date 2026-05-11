import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthProvider, useUser } from "../src/context/context";
import { apiClient } from "../src/lib/hooks";

vi.mock("../src/lib/hooks", () => ({
  apiClient: vi.fn(),
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
  });

  test("probes the current session on mount even without the local storage hint", async () => {
    localStorage.removeItem("isLoggedIn");
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
      expect(apiClient).toHaveBeenCalledWith("me");
    });
    expect(await screen.findByText("session@example.com")).toBeInTheDocument();
    expect(screen.getByText("loaded")).toBeInTheDocument();
  });

  test("refreshes once after a 401 before restoring the session", async () => {
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
