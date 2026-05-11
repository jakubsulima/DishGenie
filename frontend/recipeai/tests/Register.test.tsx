import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Register from "../src/pages/Register";
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

describe("Register Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders the current register form", () => {
    renderWithRouter(<Register />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeInTheDocument();
  });

  test("shows mismatch validation for passwords", async () => {
    renderWithRouter(<Register />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(screen.getByText("Passwords must match")).toBeInTheDocument();
    });
  });

  test("shows validation errors for blank inputs", async () => {
    renderWithRouter(<Register />);

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(screen.getByText("Email is required")).toBeInTheDocument();
      expect(
        screen.getByText("Password must be at least 8 characters"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Confirm Password is required"),
      ).toBeInTheDocument();
    });
  });

  test("submits valid registration data through the API client", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      email: "test@example.com",
      id: 7,
      role: "USER",
    });

    render(<Register />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith("register", true, {
        email: "test@example.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });
    });
    expect(setUserMock).toHaveBeenCalled();
    expect(refreshSessionMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/My Profile", {
      replace: true,
      state: { fromRegistration: true },
    });
  });
});
