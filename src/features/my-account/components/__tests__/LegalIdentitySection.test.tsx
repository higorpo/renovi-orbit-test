import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { LegalIdentitySection } from "../LegalIdentitySection";
import type { ProviderAccountFormData } from "../../types/providerAccountForm.validation";

const defaultPf: ProviderAccountFormData = {
  full_name: "Maria",
  phone: "",
  entity_type: "pf",
  profile_visibility: "restricted",
  cpf: "",
};

const defaultPj: ProviderAccountFormData = {
  ...defaultPf,
  entity_type: "pj",
  cnpj: "",
  razao_social: "",
  nome_fantasia: "",
  legal_representative_name: "",
  legal_representative_cpf: "",
  commercial_contact: "",
};

function WrapperPf() {
  const form = useForm<ProviderAccountFormData>({ defaultValues: defaultPf });
  return (
    <Form {...form}>
      <LegalIdentitySection form={form} entityType="pf" />
    </Form>
  );
}

function WrapperPj() {
  const form = useForm<ProviderAccountFormData>({ defaultValues: defaultPj });
  return (
    <Form {...form}>
      <LegalIdentitySection form={form} entityType="pj" />
    </Form>
  );
}

describe("LegalIdentitySection", () => {
  it("renders section title", () => {
    render(<WrapperPf />);
    expect(screen.getByText("Dados legais / identidade")).toBeInTheDocument();
  });

  it("renders only CPF field when entityType is pf", () => {
    render(<WrapperPf />);
    expect(screen.getByLabelText(/^CPF$/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/CNPJ/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Razão social/)).not.toBeInTheDocument();
  });

  it("renders CNPJ, razão social and PJ fields when entityType is pj", () => {
    render(<WrapperPj />);
    expect(screen.getByLabelText(/CNPJ/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Razão social/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome fantasia/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Representante legal/)).toBeInTheDocument();
    expect(screen.getByLabelText(/CPF do representante legal/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contato comercial/)).toBeInTheDocument();
  });

  it("disables inputs when disabled is true", () => {
    function DisabledTestWrapper() {
      const form = useForm<ProviderAccountFormData>({ defaultValues: defaultPf });
      return (
        <Form {...form}>
          <LegalIdentitySection form={form} entityType="pf" disabled />
        </Form>
      );
    }
    render(<DisabledTestWrapper />);
    expect(screen.getByLabelText(/^CPF$/)).toBeDisabled();
  });

  it("applies CPF mask on change for PF", () => {
    render(<WrapperPf />);
    const cpf = screen.getByLabelText(/^CPF$/);
    fireEvent.change(cpf, { target: { value: "12345678901" } });
    expect(cpf).toHaveValue("123.456.789-01");
  });

  it("applies CNPJ and representative CPF masks for PJ", () => {
    render(<WrapperPj />);
    const cnpj = screen.getByLabelText(/CNPJ/);
    fireEvent.change(cnpj, { target: { value: "11222333000181" } });
    expect(cnpj).toHaveValue("11.222.333/0001-81");

    const repCpf = screen.getByLabelText(/CPF do representante legal/);
    fireEvent.change(repCpf, { target: { value: "52998224725" } });
    expect(repCpf).toHaveValue("529.982.247-25");
  });
});
