import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ProviderSignup from "../ProviderSignup";

vi.mock("../../../hooks/useProviderSignupForm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../hooks/useProviderSignupForm")>();
  return {
    ...actual,
    useProviderSignupForm: vi.fn(),
  };
});

const { useProviderSignupForm } = await import(
  "../../../hooks/useProviderSignupForm"
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
  getEmailRedirectTo: vi.fn().mockReturnValue("https://app.example/onboarding/provider"),
};

describe("ProviderSignup", () => {
  it("renders heading", () => {
    vi.mocked(useProviderSignupForm).mockReturnValue(defaultForm);
    render(
      <MemoryRouter>
        <ProviderSignup />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: /Cadastro de Profissional/i })
    ).toBeInTheDocument();
  });
});
