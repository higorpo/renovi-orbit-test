import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { useMemo, useState, type ReactElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientSignupForm } from "../ClientSignupForm";
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
    <ClientSignupForm
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

describe("ClientSignupForm", () => {
  beforeEach(() => {
    onSubmitMock.mockClear();
  });

  it("step 0: fills name and advances on Continuar", () => {
    renderForm(<Harness />);
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: "Maria Silva" },
    });
    fireEvent.change(screen.getByLabelText(/Email \*/i), {
      target: { value: "maria@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(
      screen.getByPlaceholderText("Mínimo 10 caracteres")
    ).toBeInTheDocument();
  });

  it("step 1: toggles password visibility", () => {
    renderForm(<Harness initialStep={1} />);
    const pwd = screen.getByPlaceholderText("Mínimo 10 caracteres");
    expect(pwd).toHaveAttribute("type", "password");
    const showPwdButtons = screen.getAllByRole("button", {
      name: /Mostrar senha/i,
    });
    fireEvent.click(showPwdButtons[0]);
    expect(pwd).toHaveAttribute("type", "text");
  });

  it("step 2: requires terms before submit and calls onSubmit", () => {
    renderForm(<Harness initialStep={2} />);
    const submit = screen.getByRole("button", { name: /Criar minha conta/i });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Li e aceito/i }));
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);
    expect(onSubmitMock).toHaveBeenCalledTimes(1);
  });

  it("shows field errors from props", () => {
    renderForm(
      <Harness
        errors={{ fullName: "Informe seu nome", email: "Email inválido" }}
      />
    );
    expect(screen.getByText("Informe seu nome")).toBeInTheDocument();
    expect(screen.getByText("Email inválido")).toBeInTheDocument();
  });

  it("success state shows confirmation copy and registered email", () => {
    renderForm(
      <Harness signupSuccess registeredEmail="user@test.com" />
    );
    expect(
      screen.getByRole("heading", { name: /Cadastro realizado com sucesso/i })
    ).toBeInTheDocument();
    expect(screen.getByText("user@test.com")).toBeInTheDocument();
  });

  it("step 1: Voltar returns to step 0", () => {
    renderForm(<Harness initialStep={1} />);
    fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(screen.getByLabelText(/Nome Completo/i)).toBeInTheDocument();
  });
});
