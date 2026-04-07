import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ForgotPassword from "../ForgotPassword";

vi.mock("../../../hooks/useForgotPasswordForm", () => ({
  useForgotPasswordForm: vi.fn(),
}));

const { useForgotPasswordForm } = await import(
  "../../../hooks/useForgotPasswordForm"
);

describe("ForgotPassword", () => {
  it("renders form when not sent", () => {
    vi.mocked(useForgotPasswordForm).mockReturnValue({
      formData: { email: "" },
      setFormData: vi.fn(),
      errors: {},
      submitting: false,
      sent: false,
      handleSubmit: vi.fn(),
    });
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: /Esqueceu sua senha/i })
    ).toBeInTheDocument();
  });

  it("renders success when sent", () => {
    vi.mocked(useForgotPasswordForm).mockReturnValue({
      formData: { email: "a@b.com" },
      setFormData: vi.fn(),
      errors: {},
      submitting: false,
      sent: true,
      handleSubmit: vi.fn(),
    });
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: /Email enviado/i })).toBeInTheDocument();
  });
});
