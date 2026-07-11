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

  it("success state shows spam-folder guidance", () => {
    renderForm(<Harness signupSuccess registeredEmail="user@test.com" />);
    expect(screen.getByText("Não encontrou o email?")).toBeInTheDocument();
    expect(screen.getByText(/pasta de/i)).toBeInTheDocument();
  });

  it("unchecking terms disables submit again", () => {
    renderForm(<Harness initialStep={2} />);
    const terms = screen.getByRole("checkbox");
    fireEvent.click(terms);
    expect(terms).toBeChecked();
    fireEvent.click(terms);
    expect(terms).not.toBeChecked();
  });

  it("renders legal links with empty base URL", () => {
    vi.stubEnv("VITE_MAIN_SITE_URL", "");
    renderForm(<Harness initialStep={2} />);
    expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute(
      "href",
      "/juridico/termos-de-uso",
    );
    vi.unstubAllEnvs();
  });

  it("step 1: Voltar returns to step 0", () => {
    renderForm(<Harness initialStep={1} />);
    fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(screen.getByLabelText(/Nome Completo/i)).toBeInTheDocument();
  });

  it("renders muted future progress steps at step 0 and completed steps at step 2", () => {
    const { container, unmount } = renderForm(<Harness />);
    expect(container.querySelectorAll(".bg-white\\/20.text-white\\/50")).toHaveLength(2);
    unmount();

    const final = renderForm(<Harness initialStep={2} />);
    expect(
      final.container.firstElementChild?.querySelectorAll("svg")
    ).toHaveLength(2);
    expect(final.container.querySelectorAll(".bg-white.text-\\[\\#0F2F3A\\]")).toHaveLength(1);
  });

  it("step 1 hides password again and toggles confirm password visibility", () => {
    renderForm(<Harness initialStep={1} />);
    const password = screen.getByLabelText(/^Senha \*/i);
    const confirmation = screen.getByLabelText(/Confirmar Senha/i);

    fireEvent.click(screen.getAllByRole("button", { name: /Mostrar senha/i })[0]);
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: /Ocultar senha/i }));
    expect(password).toHaveAttribute("type", "password");

    fireEvent.click(screen.getAllByRole("button", { name: /Mostrar senha/i })[1]);
    expect(confirmation).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: /Ocultar senha/i }));
    expect(confirmation).toHaveAttribute("type", "password");
  });

  it("step 1 shows password strength, passing and failing requirements, and errors", () => {
    const { container } = renderForm(
      <Harness
        initialStep={1}
        errors={{
          password: "Senha inválida",
          confirmPassword: "Senhas diferentes",
        }}
      />
    );
    fireEvent.change(screen.getByLabelText(/^Senha \*/i), {
      target: { value: "Longpassword" },
    });

    expect(screen.getByText("Senha inválida")).toBeInTheDocument();
    expect(screen.getByText("Senhas diferentes")).toBeInTheDocument();
    expect(container.querySelector("div[style*='width']")).toBeInTheDocument();
    expect(container.querySelectorAll("svg.lucide-check").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("svg.lucide-x").length).toBeGreaterThan(0);
  });

  it("step 2 shows validation errors, submitting state, and returns on Voltar", () => {
    renderForm(
      <Harness
        initialStep={2}
        submitting
        errors={{
          termsAccepted: "Aceite os termos",
          recaptcha: "Confirme o reCAPTCHA",
        }}
      />
    );

    expect(screen.getByText("Aceite os termos")).toBeInTheDocument();
    expect(screen.getByText("Confirme o reCAPTCHA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Criando/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(screen.getByLabelText(/^Senha \*/i)).toBeInTheDocument();
  });

  it("normalizes legal link URLs with or without a trailing slash", () => {
    vi.stubEnv("VITE_MAIN_SITE_URL", "https://renovi.test/");
    const { unmount } = renderForm(<Harness initialStep={2} />);
    expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute(
      "href",
      "https://renovi.test/juridico/termos-de-uso"
    );
    unmount();

    vi.stubEnv("VITE_MAIN_SITE_URL", "https://renovi.test");
    renderForm(<Harness initialStep={2} />);
    expect(
      screen.getByRole("link", { name: "Política de Privacidade" })
    ).toHaveAttribute(
      "href",
      "https://renovi.test/juridico/politica-de-privacidade"
    );
    vi.unstubAllEnvs();
  });
});
