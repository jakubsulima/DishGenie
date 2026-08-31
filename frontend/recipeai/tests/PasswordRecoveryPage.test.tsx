import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ForgotPasswordPage,
  ResetPasswordPage,
} from "../src/pages/PasswordRecoveryPage";
import { apiClient } from "../src/lib/hooks";
import { renderWithRouter } from "./testUtils";

vi.mock("../src/lib/hooks", () => ({ apiClient: vi.fn() }));

describe("password recovery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the same generic confirmation after requesting a reset", async () => {
    vi.mocked(apiClient).mockResolvedValue(undefined);
    renderWithRouter(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith("forgot-password", true, {
        email: "person@example.com",
        locale: "en",
      }),
    );
    expect(
      screen.getByText(
        "If an eligible account exists, a password reset link has been sent.",
      ),
    ).toBeInTheDocument();
  });

  it("rejects a reset page without a token before calling the API", () => {
    renderWithRouter(<ResetPasswordPage />, ["/reset-password"]);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));

    expect(screen.getByText("This password reset link is invalid.")).toBeInTheDocument();
    expect(apiClient).not.toHaveBeenCalled();
  });

  it("submits a strong password with the reset token", async () => {
    vi.mocked(apiClient).mockResolvedValue(undefined);
    renderWithRouter(<ResetPasswordPage />, ["/reset-password?token=secure-token"]);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));

    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith("reset-password", true, {
        token: "secure-token",
        password: "StrongPass1!",
      }),
    );
    expect(screen.getByText("Your password has been updated.")).toBeInTheDocument();
  });
});
