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

  it("success state shows spam-folder guidance", () => {
    renderForm(<Harness signupSuccess registeredEmail="pro@example.com" />);
    expect(screen.getByText("Não encontrou o email?")).toBeInTheDocument();
    expect(screen.getByText(/spam/i)).toBeInTheDocument();
  });

  it("shows submitting state on final button", () => {
    renderForm(<Harness initialStep={2} submitting />);
    expect(screen.getByText("Criando...")).toBeInTheDocument();
  });

  it("renders step 0 field errors and muted future progress steps", () => {
    const { container } = renderForm(
      <Harness errors={{ fullName: "Informe o nome", email: "Email inválido" }} />
    );
    expect(screen.getByText("Informe o nome")).toBeInTheDocument();
    expect(screen.getByText("Email inválido")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-white\\/20.text-white\\/50")).toHaveLength(2);
  });

  it("renders completed progress checks at step 2", () => {
    const { container } = renderForm(<Harness initialStep={2} />);
    expect(container.firstElementChild?.querySelectorAll("svg")).toHaveLength(2);
    expect(container.querySelectorAll(".bg-white.text-\\[\\#0F2F3A\\]")).toHaveLength(1);
  });

  it("step 1 toggles password show and hide and renders strength branches", () => {
    const { container } = renderForm(
      <Harness
        initialStep={1}
        errors={{
          password: "Senha inválida",
          confirmPassword: "Senhas diferentes",
        }}
      />
    );
    const password = screen.getByLabelText(/^Senha \*/i);
    fireEvent.click(screen.getAllByRole("button", { name: /Mostrar senha/i })[0]);
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: /Ocultar senha/i }));
    expect(password).toHaveAttribute("type", "password");

    fireEvent.change(password, { target: { value: "Longpassword" } });
    expect(screen.getByText("Senha inválida")).toBeInTheDocument();
    expect(screen.getByText("Senhas diferentes")).toBeInTheDocument();
    expect(container.querySelector("div[style*='width']")).toBeInTheDocument();
    expect(container.querySelectorAll("svg.lucide-check").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("svg.lucide-x").length).toBeGreaterThan(0);
  });

  it("step 2 keeps submit disabled before terms acceptance and shows errors", () => {
    renderForm(
      <Harness
        initialStep={2}
        errors={{
          termsAccepted: "Aceite os termos",
          recaptcha: "Confirme o reCAPTCHA",
        }}
      />
    );
    expect(screen.getByRole("button", { name: /Criar minha conta/i })).toBeDisabled();
    expect(screen.getByText("Aceite os termos")).toBeInTheDocument();
    expect(screen.getByText("Confirme o reCAPTCHA")).toBeInTheDocument();
  });

  it("step 2 returns to password entry and exposes every legal link", () => {
    renderForm(<Harness initialStep={2} />);
    const terms = screen.getByRole("link", { name: "Termos de Uso" });
    const adhesion = screen.getByRole("link", { name: "Contrato de Adesão" });
    const commissions = screen.getByRole("link", {
      name: "Política de Comissões",
    });

    expect(terms.getAttribute("href")).toMatch(/\/juridico\/termos-de-uso$/);
    expect(adhesion.getAttribute("href")).toMatch(/\/juridico\/adesao-prestador$/);
    expect(commissions.getAttribute("href")).toMatch(
      /\/juridico\/comissao-prestador$/
    );
    expect(terms.getAttribute("href")).not.toContain("//juridico");

    fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(screen.getByLabelText(/^Senha \*/i)).toBeInTheDocument();
  });

  it("disables the final button and shows a loader while submitting", () => {
    renderForm(<Harness initialStep={2} submitting />);
    const submit = screen.getByRole("button", { name: /Criando/i });
    expect(submit).toBeDisabled();
    expect(submit.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
