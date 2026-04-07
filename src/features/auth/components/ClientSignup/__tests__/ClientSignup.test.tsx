import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ClientSignup from "../ClientSignup";

vi.mock("../../../hooks/useClientSignupForm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../hooks/useClientSignupForm")>();
  return {
    ...actual,
    useClientSignupForm: vi.fn(),
  };
});

const { useClientSignupForm } = await import(
  "../../../hooks/useClientSignupForm"
);

const defaultForm = {
  currentStep: 0,
  formData: {
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  },
  setFormData: vi.fn(),
  errors: {} as Record<string, string>,
  submitting: false,
  signupSuccess: false,
  showPassword: false,
  setShowPassword: vi.fn(),
  showConfirmPassword: false,
  setShowConfirmPassword: vi.fn(),
  passwordDisplay: { label: "", colorClass: "", widthPercent: 0 },
  handleNext: vi.fn(),
  handleBack: vi.fn(),
  handleSubmit: vi.fn(),
  handleGoogleSignup: vi.fn(),
  setErrors: vi.fn(),
  validateStep: vi.fn().mockReturnValue(true),
  getEmailRedirectTo: vi.fn().mockReturnValue("https://app.example/onboarding/client"),
};

describe("ClientSignup", () => {
  it("renders wizard and login link when not successful", () => {
    vi.mocked(useClientSignupForm).mockReturnValue(defaultForm);
    render(
      <MemoryRouter>
        <ClientSignup />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: /Cadastro de Cliente/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fazer login/i })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("hides footer CTAs when signupSuccess", () => {
    vi.mocked(useClientSignupForm).mockReturnValue({
      ...defaultForm,
      signupSuccess: true,
    });
    render(
      <MemoryRouter>
        <ClientSignup />
      </MemoryRouter>
    );
    expect(
      screen.queryByRole("link", { name: /Solicitar orçamento/i })
    ).not.toBeInTheDocument();
  });
});
