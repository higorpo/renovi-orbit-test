import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { DadosPessoaisSection } from "../DadosPessoaisSection";
import type { AccountFormData } from "../../types/accountForm.validation";

function Wrapper({
  defaultValues,
  email,
}: {
  defaultValues: AccountFormData;
  email: string;
}) {
  const form = useForm<AccountFormData>({ defaultValues });
  return (
    <Form {...form}>
      <DadosPessoaisSection form={form} email={email} />
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
});
