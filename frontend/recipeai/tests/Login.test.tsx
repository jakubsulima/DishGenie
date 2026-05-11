import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Login from "../src/pages/Login";
import { apiClient } from "../src/lib/hooks";
import { renderWithRouter } from "./testUtils";

const navigateMock = vi.fn();
const setUserMock = vi.fn();
const refreshSessionMock = vi.fn().mockResolvedValue(true);

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../src/lib/hooks", () => ({
  apiClient: vi.fn(),
}));

vi.mock("../src/context/context", () => ({
  useUser: () => ({
    setUser: setUserMock,
    refreshSession: refreshSessionMock,
    user: null,
    loading: false,
  }),
}));

vi.mock("../src/lib/runtimeConfig", () => ({
  getGoogleClientId: () => "",
}));

describe("Login Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders the current form labels and actions", () => {
    renderWithRouter(<Login />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create one" }),
    ).toBeInTheDocument();
  });

  test("updates input values on change", () => {
    renderWithRouter(<Login />);

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");

    fireEvent.change(emailInput, { target: { value: "testuser@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "Password123!" } });

    expect(emailInput).toHaveValue("testuser@example.com");
    expect(passwordInput).toHaveValue("Password123!");
  });

  test("shows validation errors for blank inputs", async () => {
    renderWithRouter(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Email is required")).toBeInTheDocument();
      expect(screen.getByText("Password is required")).toBeInTheDocument();
    });
  });

  test("submits credentials with the current API client", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      email: "testuser@example.com",
      id: 1,
      role: "USER",
    });

    render(<Login />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "testuser@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith("login", true, {
        email: "testuser@example.com",
        password: "Password123!",
      });
    });
    expect(setUserMock).toHaveBeenCalled();
    expect(refreshSessionMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
  });
});
