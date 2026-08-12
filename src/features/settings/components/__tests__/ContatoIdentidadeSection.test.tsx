import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { ContatoIdentidadeSection } from "../ContatoIdentidadeSection";
import type { AccountFormData } from "../../types/accountForm.validation";

function Wrapper({ defaultValues }: { defaultValues: AccountFormData }) {
  const form = useForm<AccountFormData>({ defaultValues });
  return (
    <Form {...form}>
      <ContatoIdentidadeSection form={form} />
    </Form>
  );
}

describe("ContatoIdentidadeSection", () => {
  it("renders section title and phone field", () => {
    render(
      <Wrapper defaultValues={{ full_name: "Maria", phone: "", cpf: "" }} />
    );
    expect(screen.getByText("Contato e identidade")).toBeInTheDocument();
    expect(screen.getByLabelText(/Telefone \/ WhatsApp/)).toBeInTheDocument();
  });

  it("renders CPF field with description", () => {
    render(
      <Wrapper defaultValues={{ full_name: "Maria", phone: "", cpf: "" }} />
    );
    expect(screen.getByLabelText(/CPF/)).toBeInTheDocument();
    expect(
      screen.getByText(/Seu CPF é usado apenas para validação/)
    ).toBeInTheDocument();
  });

  it("applies phone mask on change", () => {
    render(
      <Wrapper defaultValues={{ full_name: "Maria", phone: "", cpf: "" }} />
    );
    const phoneInput = screen.getByLabelText(/Telefone \/ WhatsApp/);
    fireEvent.change(phoneInput, { target: { value: "11987654321" } });
    expect(phoneInput).toHaveValue("(11) 98765-4321");
  });

  it("applies CPF mask on change", () => {
    render(
      <Wrapper defaultValues={{ full_name: "Maria", phone: "", cpf: "" }} />
    );
    const cpfInput = screen.getByLabelText(/CPF/);
    fireEvent.change(cpfInput, { target: { value: "12345678900" } });
    expect(cpfInput).toHaveValue("123.456.789-00");
  });
});
