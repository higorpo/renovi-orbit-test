import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useMemo, useState, type FormEvent } from "react";
import { ResetPasswordForm } from "../ResetPasswordForm";
import { validatePasswordStrength } from "../../../utils/passwordPolicy";

const onSubmit = vi.fn((e: FormEvent) => {
  e.preventDefault();
});

function Harness({
  errors = {} as Record<string, string>,
  submitting = false,
}: {
  errors?: Record<string, string>;
  submitting?: boolean;
}) {
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordStrength = useMemo(
    () => validatePasswordStrength(formData.password).strength,
    [formData.password]
  );

  return (
    <ResetPasswordForm
      formData={formData}
      setFormData={setFormData}
      errors={errors}
      submitting={submitting}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      showConfirmPassword={showConfirmPassword}
      setShowConfirmPassword={setShowConfirmPassword}
      passwordStrength={passwordStrength}
      onSubmit={onSubmit}
    />
  );
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    onSubmit.mockClear();
  });

  it("updates password fields and toggles visibility", () => {
    render(<Harness />);
    const pwd = screen.getByLabelText(/^Nova senha/i);
    fireEvent.change(pwd, { target: { value: "Abcdef1!xx" } });
    expect(pwd).toHaveValue("Abcdef1!xx");
    expect(pwd).toHaveAttribute("type", "password");
    fireEvent.click(
      screen.getAllByRole("button", { name: /Mostrar senha/i })[0]
    );
    expect(pwd).toHaveAttribute("type", "text");
    fireEvent.change(screen.getByLabelText(/Confirmar nova senha/i), {
      target: { value: "Abcdef1!xx" },
    });
  });

  it("submits the form", () => {
    render(<Harness />);
    const form = screen.getByRole("button", { name: /Redefinir senha/i }).closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("shows field errors", () => {
    render(
      <Harness
        errors={{
          password: "Senha fraca",
          confirmPassword: "Nao confere",
        }}
      />
    );
    expect(screen.getByText("Senha fraca")).toBeInTheDocument();
    expect(screen.getByText("Nao confere")).toBeInTheDocument();
  });

  it("disables submit while submitting", () => {
    render(<Harness submitting />);
    expect(screen.getByRole("button", { name: /Salvando/i })).toBeDisabled();
  });
});
