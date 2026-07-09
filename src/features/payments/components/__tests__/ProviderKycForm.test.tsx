// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderKycForm } from "../ProviderKycForm";
import * as kycApi from "../../api/kyc.api";

const mutateAsync = vi.fn();
const onSubmitted = vi.fn();
const dispatchKycIsPending = { current: false };

vi.mock("../../hooks/useDispatchKyc", () => ({
  useDispatchKyc: () => ({
    mutateAsync,
    get isPending() {
      return dispatchKycIsPending.current;
    },
  }),
}));

vi.mock("../../api/kyc.api", () => ({
  uploadKycDocument: vi.fn(),
}));

function fillCpfForm() {
  fireEvent.change(screen.getByLabelText("Nome completo"), {
    target: { value: "João Silva" },
  });
  fireEvent.change(screen.getByLabelText("CPF"), {
    target: { value: "390.533.447-05" },
  });
  fireEvent.change(screen.getByLabelText("Telefone"), {
    target: { value: "48999999999" },
  });
  fireEvent.change(screen.getByLabelText("Banco"), {
    target: { value: "001" },
  });
  fireEvent.change(screen.getByLabelText("Agência"), {
    target: { value: "1234" },
  });
  fireEvent.change(screen.getByLabelText("Conta"), {
    target: { value: "56789-0" },
  });

  const identity = new File(["id"], "id.pdf", { type: "application/pdf" });
  const address = new File(["addr"], "addr.pdf", { type: "application/pdf" });
  fireEvent.change(screen.getByLabelText(/Documento de identidade/i), {
    target: { files: [identity] },
  });
  fireEvent.change(screen.getByLabelText(/Comprovante de endereço/i), {
    target: { files: [address] },
  });
}

describe("ProviderKycForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchKycIsPending.current = false;
    vi.mocked(kycApi.uploadKycDocument).mockResolvedValue({
      path: "providers/provider-1/kyc/identity/document.pdf",
      signedUrl: "https://signed.example/doc.pdf",
      error: null,
    });
    mutateAsync.mockResolvedValue({
      submissionId: "sub-1",
      emailDispatched: true,
    });
  });

  it("hides CNPJ-only fields when entity type is CPF", () => {
    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    expect(screen.queryByTestId("kyc-cnpj-fields")).toBeNull();
    expect(screen.queryByLabelText("Razão social")).toBeNull();
  });

  it("shows CNPJ-only fields when entity type is CNPJ", () => {
    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Pessoa jurídica \(CNPJ\)/i }));

    expect(screen.getByTestId("kyc-cnpj-fields")).toBeInTheDocument();
    expect(screen.getByLabelText("Razão social")).toBeInTheDocument();
  });

  it("uploads documents and dispatches KYC on valid CPF submit", async () => {
    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
        onSubmitted={onSubmitted}
      />,
    );

    fillCpfForm();
    fireEvent.click(screen.getByRole("button", { name: /Enviar credenciamento/i }));

    await waitFor(() => {
      expect(kycApi.uploadKycDocument).toHaveBeenCalled();
      expect(mutateAsync).toHaveBeenCalled();
      expect(onSubmitted).toHaveBeenCalled();
    });
  });

  it("shows upload error when document upload fails", async () => {
    vi.mocked(kycApi.uploadKycDocument).mockResolvedValue({
      path: null,
      signedUrl: null,
      error: "upload failed",
    });

    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    fillCpfForm();
    fireEvent.click(screen.getByRole("button", { name: /Enviar credenciamento/i }));

    await waitFor(() => {
      expect(screen.getByText("upload failed")).toBeInTheDocument();
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("uploads CNPJ documents and dispatches KYC", async () => {
    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
        onSubmitted={onSubmitted}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Pessoa jurídica \(CNPJ\)/i }));

    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Empresa LTDA" },
    });
    fireEvent.change(screen.getByLabelText("CNPJ"), {
      target: { value: "11.444.777/0001-61" },
    });
    fireEvent.change(screen.getByLabelText("Telefone"), {
      target: { value: "48999999999" },
    });
    fireEvent.change(screen.getByLabelText("Razão social"), {
      target: { value: "Empresa LTDA" },
    });
    fireEvent.change(screen.getByLabelText("Nome fantasia"), {
      target: { value: "Empresa" },
    });
    fireEvent.change(screen.getByLabelText("Nome do representante legal"), {
      target: { value: "Maria Silva" },
    });
    fireEvent.change(screen.getByLabelText("CPF do representante"), {
      target: { value: "390.533.447-05" },
    });
    fireEvent.change(screen.getByLabelText("Telefone do representante"), {
      target: { value: "48988887777" },
    });
    fireEvent.change(screen.getByLabelText("Banco"), {
      target: { value: "001" },
    });
    fireEvent.change(screen.getByLabelText("Agência"), {
      target: { value: "1234" },
    });
    fireEvent.change(screen.getByLabelText("Conta"), {
      target: { value: "56789-0" },
    });

    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/Documento de identidade/i), {
      target: { files: [pdf] },
    });
    fireEvent.change(screen.getByLabelText(/Comprovante de endereço/i), {
      target: { files: [pdf] },
    });
    fireEvent.change(screen.getByLabelText(/Contrato social/i), {
      target: { files: [pdf] },
    });
    fireEvent.change(screen.getByLabelText(/Documento do representante legal/i), {
      target: { files: [pdf] },
    });

    fireEvent.click(screen.getByRole("button", { name: /Enviar credenciamento/i }));

    await waitFor(() => {
      expect(kycApi.uploadKycDocument).toHaveBeenCalledTimes(4);
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "CNPJ",
          razaoSocial: "Empresa LTDA",
        }),
      );
      expect(onSubmitted).toHaveBeenCalled();
    });
  });

  it("shows validation error when required fields are missing", async () => {
    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Enviar credenciamento/i }));

    await waitFor(() => {
      expect(screen.getByText(/Informe o nome completo|Envie o documento/i)).toBeInTheDocument();
    });
  });

  it("shows pending submit label while dispatch is in flight", () => {
    dispatchKycIsPending.current = true;

    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    expect(
      screen.getByRole("button", { name: /Enviando credenciamento/i }),
    ).toBeDisabled();
  });

  it("shows dispatch error when mutation rejects", async () => {
    mutateAsync.mockRejectedValue(new Error("dispatch failed"));

    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    fillCpfForm();
    fireEvent.click(screen.getByRole("button", { name: /Enviar credenciamento/i }));

    await waitFor(() => {
      expect(screen.getByText("dispatch failed")).toBeInTheDocument();
    });
  });

  it("shows generic upload error when upload fails without message", async () => {
    vi.mocked(kycApi.uploadKycDocument).mockResolvedValue({
      path: null,
      signedUrl: null,
      error: null,
    });

    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    fillCpfForm();
    fireEvent.click(screen.getByRole("button", { name: /Enviar credenciamento/i }));

    await waitFor(() => {
      expect(screen.getByText("Falha ao enviar documentos")).toBeInTheDocument();
    });
  });

  it("shows generic submit error when rejection is not an Error", async () => {
    mutateAsync.mockRejectedValue("boom");

    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    fillCpfForm();
    fireEvent.click(screen.getByRole("button", { name: /Enviar credenciamento/i }));

    await waitFor(() => {
      expect(screen.getByText("Falha ao enviar credenciamento")).toBeInTheDocument();
    });
  });
});
