import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ResetPassword from "../ResetPassword";

vi.mock("../../../hooks/useResetPassword", () => ({
  useResetPassword: vi.fn(),
}));

const { useResetPassword } = await import("../../../hooks/useResetPassword");

const base = {
  recoveryMode: true,
  formData: { password: "", confirmPassword: "" },
  setFormData: vi.fn(),
  errors: {} as Record<string, string>,
  submitting: false,
  showPassword: false,
  setShowPassword: vi.fn(),
  showConfirmPassword: false,
  setShowConfirmPassword: vi.fn(),
  passwordStrength: 0,
  handleSubmit: vi.fn(),
};

describe("ResetPassword", () => {
  it("shows form in recovery mode", () => {
    vi.mocked(useResetPassword).mockReturnValue(base);
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: /Crie uma nova senha/i })
    ).toBeInTheDocument();
  });

  it("shows link-only state when not in recovery mode", () => {
    vi.mocked(useResetPassword).mockReturnValue({
      ...base,
      recoveryMode: false,
    });
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: /Link de redefinição/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Solicitar novo link/i })).toHaveAttribute(
      "href",
      "/esqueceu-senha"
    );
  });
});
