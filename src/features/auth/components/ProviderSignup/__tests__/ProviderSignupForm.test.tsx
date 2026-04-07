import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { useMemo, useState, type ReactElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProviderSignupForm } from "../ProviderSignupForm";
import { getPasswordStrengthDisplay } from "../../../utils/passwordPolicy";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<React.ComponentProps<"div">>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const onSubmitMock = vi.fn();

function Harness({
  initialStep = 0,
  errors = {} as Record<string, string>,
  submitting = false,
  signupSuccess = false,
  registeredEmail = "",
}: {
  initialStep?: number;
  errors?: Record<string, string>;
  submitting?: boolean;
  signupSuccess?: boolean;
  registeredEmail?: string;
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordDisplay = useMemo(
    () => getPasswordStrengthDisplay(formData.password),
    [formData.password]
  );

  return (
    <ProviderSignupForm
      currentStep={currentStep}
      formData={formData}
      setFormData={setFormData}
      errors={errors}
      submitting={submitting}
      signupSuccess={signupSuccess}
      registeredEmail={registeredEmail}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      showConfirmPassword={showConfirmPassword}
      setShowConfirmPassword={setShowConfirmPassword}
      passwordDisplay={passwordDisplay}
      onNext={() => setCurrentStep((s) => Math.min(s + 1, 2))}
      onBack={() => setCurrentStep((s) => Math.max(s - 1, 0))}
      onSubmit={onSubmitMock}
      onGoogleSignup={vi.fn()}
    />
  );
}

function renderForm(ui: ReactElement) {
  return render(ui);
}

describe("ProviderSignupForm", () => {
  beforeEach(() => {
    onSubmitMock.mockClear();
  });

  it("step 0 advances after Continuar", () => {
    renderForm(<Harness />);
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: "Joao Souza" },
    });
    fireEvent.change(screen.getByLabelText(/Email \*/i), {
      target: { value: "joao@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(
      screen.getByPlaceholderText("Mínimo 10 caracteres")
    ).toBeInTheDocument();
  });

  it("step 1 toggles confirm password visibility", () => {
    renderForm(<Harness initialStep={1} />);
    const field = screen.getByLabelText(/Confirmar Senha/i);
    expect(field).toHaveAttribute("type", "password");
    const buttons = screen.getAllByRole("button", { name: /Mostrar senha/i });
    fireEvent.click(buttons[1]);
    expect(field).toHaveAttribute("type", "text");
  });

  it("step 2 accepts terms and submits", () => {
    renderForm(<Harness initialStep={2} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Li e aceito/i }));
    fireEvent.click(screen.getByRole("button", { name: /Criar minha conta/i }));
    expect(onSubmitMock).toHaveBeenCalledTimes(1);
  });

  it("success state shows registered email", () => {
    renderForm(<Harness signupSuccess registeredEmail="pro@example.com" />);
    expect(
      screen.getByRole("heading", { name: /Cadastro realizado com sucesso/i })
    ).toBeInTheDocument();
    expect(screen.getByText("pro@example.com")).toBeInTheDocument();
  });

  it("shows submitting state on final button", () => {
    renderForm(<Harness initialStep={2} submitting />);
    expect(screen.getByText("Criando...")).toBeInTheDocument();
  });
});
