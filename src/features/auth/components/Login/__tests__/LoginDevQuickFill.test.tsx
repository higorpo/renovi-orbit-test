import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { LoginDevQuickFill } from "../LoginDevQuickFill";
import type { SignInFormData } from "../../../types/login.validation";

function Harness() {
  const [formData, setFormData] = useState<SignInFormData>({
    email: "",
    password: "",
  });
  return (
    <>
      <LoginDevQuickFill setFormData={setFormData} />
      <span data-testid="email">{formData.email}</span>
      <span data-testid="password">{formData.password}</span>
    </>
  );
}

describe("LoginDevQuickFill", () => {
  it("fills client credentials", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /^Cliente$/i }));
    expect(screen.getByTestId("email")).toHaveTextContent("cliente@renovi.com.br");
    expect(screen.getByTestId("password")).toHaveTextContent("Abc123");
  });

  it("fills provider credentials", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /^Prestador$/i }));
    expect(screen.getByTestId("email")).toHaveTextContent("prestador@renovi.com.br");
    expect(screen.getByTestId("password")).toHaveTextContent("Abc123");
  });

  it("calls setFormData with both fields", () => {
    const setFormData = vi.fn();
    render(<LoginDevQuickFill setFormData={setFormData} />);
    fireEvent.click(screen.getByRole("button", { name: /^Cliente$/i }));
    expect(setFormData).toHaveBeenCalledWith({
      email: "cliente@renovi.com.br",
      password: "Abc123",
    });
  });
});
