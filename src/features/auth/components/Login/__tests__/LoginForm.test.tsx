import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { LoginForm } from "../LoginForm";
import type { SignInFormData } from "../../../types/login.validation";
import { useState, type ReactElement } from "react";

function Harness() {
  const [formData, setFormData] = useState<SignInFormData>({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  return (
    <LoginForm
      formData={formData}
      setFormData={setFormData}
      errors={{}}
      submitting={false}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      rememberMe={rememberMe}
      setRememberMe={setRememberMe}
      onSubmit={vi.fn()}
      onGoogleLogin={vi.fn()}
    />
  );
}

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("LoginForm", () => {
  it("updates email and password on input", () => {
    renderWithRouter(<Harness />);
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Sua senha/i), {
      target: { value: "secret" },
    });
    expect(screen.getByDisplayValue("a@b.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("secret")).toBeInTheDocument();
  });

  it("toggles password visibility", () => {
    renderWithRouter(<Harness />);
    const toggle = screen.getByRole("button", { name: /Mostrar senha/i });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /Ocultar senha/i })).toBeInTheDocument();
  });

  it("shows field errors", () => {
    renderWithRouter(
      <LoginForm
        formData={{ email: "", password: "" }}
        setFormData={vi.fn()}
        errors={{ email: "Bad", password: "Weak" }}
        submitting={false}
        showPassword={false}
        setShowPassword={vi.fn()}
        rememberMe
        setRememberMe={vi.fn()}
        onSubmit={vi.fn()}
        onGoogleLogin={vi.fn()}
      />
    );
    expect(screen.getByText("Bad")).toBeInTheDocument();
    expect(screen.getByText("Weak")).toBeInTheDocument();
  });

  it("calls onSubmit and onGoogleLogin", () => {
    const onSubmit = vi.fn();
    const onGoogleLogin = vi.fn();
    renderWithRouter(
      <LoginForm
        formData={{ email: "a@b.com", password: "x" }}
        setFormData={vi.fn()}
        errors={{}}
        submitting={false}
        showPassword={false}
        setShowPassword={vi.fn()}
        rememberMe
        setRememberMe={vi.fn()}
        onSubmit={onSubmit}
        onGoogleLogin={onGoogleLogin}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Entrar na minha conta/i }));
    expect(onSubmit).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Continuar com Google/i }));
    expect(onGoogleLogin).toHaveBeenCalled();
  });

  it("disables actions while submitting", () => {
    renderWithRouter(
      <LoginForm
        formData={{ email: "a@b.com", password: "x" }}
        setFormData={vi.fn()}
        errors={{}}
        submitting
        showPassword={false}
        setShowPassword={vi.fn()}
        rememberMe
        setRememberMe={vi.fn()}
        onSubmit={vi.fn()}
        onGoogleLogin={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Entrando/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Continuar com Google/i })).toBeDisabled();
  });
});
