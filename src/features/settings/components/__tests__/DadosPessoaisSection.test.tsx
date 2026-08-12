import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { DadosPessoaisSection } from "../DadosPessoaisSection";
import type { AccountFormData } from "../../types/accountForm.validation";

function Wrapper({
  defaultValues,
  email,
  showCpf,
}: {
  defaultValues: AccountFormData;
  email: string;
  showCpf?: boolean;
}) {
  const form = useForm<AccountFormData>({ defaultValues });
  return (
    <Form {...form}>
      <DadosPessoaisSection form={form} email={email} showCpf={showCpf} />
    </Form>
  );
}

describe("DadosPessoaisSection", () => {
  it("renders section title and full name field", () => {
    render(
      <Wrapper
        defaultValues={{ full_name: "Maria Silva", phone: "", cpf: "" }}
        email="maria@example.com"
      />
    );
    expect(screen.getByText("Dados pessoais")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome completo/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Maria Silva")).toBeInTheDocument();
  });

  it("renders read-only email field with description", () => {
    render(
      <Wrapper
        defaultValues={{ full_name: "Maria", phone: "", cpf: "" }}
        email="maria@example.com"
      />
    );
    const emailInput = screen.getByLabelText(/E-mail/);
    expect(emailInput).toHaveValue("maria@example.com");
    expect(emailInput).toBeDisabled();
    expect(
      screen.getByText(/Seu e-mail não pode ser alterado/)
    ).toBeInTheDocument();
  });

  it("renders CPF field with description", () => {
    render(
      <Wrapper
        defaultValues={{ full_name: "Maria", phone: "", cpf: "" }}
        email="maria@example.com"
      />
    );
    expect(screen.getByLabelText(/CPF/)).toBeInTheDocument();
    expect(
      screen.getByText(/Seu CPF é usado apenas para validação/)
    ).toBeInTheDocument();
  });

  it("applies CPF mask on change", () => {
    render(
      <Wrapper
        defaultValues={{ full_name: "Maria", phone: "", cpf: "" }}
        email="maria@example.com"
      />
    );
    const cpfInput = screen.getByLabelText(/CPF/);
    fireEvent.change(cpfInput, { target: { value: "12345678900" } });
    expect(cpfInput).toHaveValue("123.456.789-00");
  });

  it("hides CPF when showCpf is false", () => {
    render(
      <Wrapper
        defaultValues={{ full_name: "Maria", phone: "", cpf: "" }}
        email="maria@example.com"
        showCpf={false}
      />
    );
    expect(screen.queryByLabelText(/CPF/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Seu CPF é usado apenas para validação/)
    ).not.toBeInTheDocument();
  });
});
