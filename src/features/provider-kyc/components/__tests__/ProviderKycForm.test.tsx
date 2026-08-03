// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

vi.mock("../../hooks/useBrazilianBanks", () => ({
  useBrazilianBanks: () => ({
    data: [
      { code: "001", name: "Banco do Brasil" },
      { code: "260", name: "Nubank" },
      { code: "341", name: "Itaú Unibanco" },
    ],
    isLoading: false,
    isSuccess: true,
  }),
}));

vi.mock("../../api/kyc.api", async () => {
  const actual = await vi.importActual<typeof import("../../api/kyc.api")>("../../api/kyc.api");
  return {
    ...actual,
    uploadKycDocument: vi.fn(),
    fetchProviderPrivateProfileForKyc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
});

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}));

vi.mock("@/lib/sentry", () => ({
  addBreadcrumb: vi.fn(),
  metrics: { count: vi.fn() },
}));

function expectActiveStep(testId: string) {
  expect(screen.getByTestId(testId)).not.toHaveAttribute("aria-hidden", "true");
}

function expectWizardProgress(step: number) {
  const bar = screen.getByRole("progressbar");
  expect(bar).toHaveAttribute("aria-valuenow", String(step));
  expect(bar).toHaveAccessibleName(`Passo ${step} de 5`);
}

async function waitForWizardReady() {
  await waitFor(() => {
    expectActiveStep("kyc-step-entity");
  });
}

function clickContinue() {
  fireEvent.click(screen.getByRole("button", { name: /^Continuar$/i }));
}

async function goToIdentityStep() {
  await waitForWizardReady();
  clickContinue();
  await waitFor(() => {
    expectWizardProgress(2);
    expectActiveStep("kyc-step-identity");
  });
}

async function fillIdentityCpfAndContinue() {
  await goToIdentityStep();
  fireEvent.change(screen.getByLabelText("Nome completo"), {
    target: { value: "João Silva" },
  });
  fireEvent.change(screen.getByLabelText("CPF"), {
    target: { value: "390.533.447-05" },
  });
  fireEvent.change(screen.getByLabelText("Telefone"), {
    target: { value: "48999999999" },
  });
  clickContinue();
  await waitFor(() => {
    expectWizardProgress(3);
    expectActiveStep("kyc-step-bank");
  });
}

async function fillBankAndContinue() {
  fireEvent.click(screen.getByRole("combobox"));
  const option = await screen.findByText(/Banco do Brasil \(001\)/i);
  fireEvent.click(option);

  fireEvent.change(screen.getByLabelText("Agência"), {
    target: { value: "1234" },
  });
  fireEvent.change(screen.getByLabelText(/Conta com dígito/i), {
    target: { value: "56789-0" },
  });
  clickContinue();
  await waitFor(() => {
    expectWizardProgress(4);
    expectActiveStep("kyc-step-documents");
  });
}

async function fillDocumentsCpfAndContinue() {
  const identity = new File(["id"], "id.pdf", { type: "application/pdf" });
  const address = new File(["addr"], "addr.pdf", { type: "application/pdf" });
  fireEvent.change(screen.getByLabelText(/Documento de identidade/i), {
    target: { files: [identity] },
  });
  fireEvent.change(screen.getByLabelText(/Comprovante de endereço/i), {
    target: { files: [address] },
  });
  clickContinue();
  await waitFor(() => {
    expectWizardProgress(5);
    expectActiveStep("kyc-step-review");
  });
}

describe("ProviderKycForm wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchKycIsPending.current = false;
    vi.mocked(kycApi.uploadKycDocument).mockResolvedValue({
      path: "providers/provider-1/kyc/identity/document.pdf",
      signedUrl: "https://signed.example/doc.pdf",
      sessionId: "session-1",
      error: null,
    });
    vi.mocked(kycApi.fetchProviderPrivateProfileForKyc).mockResolvedValue({
      data: null,
      error: null,
    });
    mutateAsync.mockResolvedValue({
      submissionId: "sub-1",
      emailDispatched: true,
    });
  });

  it("starts on entity step and shows CNPJ fields when PJ is selected", async () => {
    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    await waitForWizardReady();
    expectWizardProgress(1);
    expect(screen.queryByTestId("kyc-cnpj-fields")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Pessoa jurídica \(CNPJ\)/i }));
    clickContinue();

    await waitFor(() => {
      expect(screen.getByTestId("kyc-cnpj-fields")).toBeInTheDocument();
    });
  });

  it("blocks advance from identity without required fields", async () => {
    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );
    await goToIdentityStep();
    clickContinue();

    await waitFor(() => {
      expect(screen.getAllByText(/Informe o nome completo/i).length).toBeGreaterThan(0);
    });
    expectWizardProgress(2);
  });

  it(
    "uploads documents with legal-rep-id key and submits identity params for CNPJ",
    async () => {
      render(
        <ProviderKycForm
          providerId="provider-1"
          accountEmail="provider@example.com"
          onSubmitted={onSubmitted}
        />,
      );

      await waitForWizardReady();
      fireEvent.click(screen.getByRole("button", { name: /Pessoa jurídica \(CNPJ\)/i }));
      clickContinue();

      await waitFor(() => {
        expectWizardProgress(2);
      });

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
      clickContinue();

      await waitFor(() => {
        expectWizardProgress(3);
      });
      await fillBankAndContinue();

      const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
      fireEvent.change(screen.getByLabelText(/Documento do representante legal/i), {
        target: { files: [pdf] },
      });
      fireEvent.change(screen.getByLabelText(/Comprovante de endereço da empresa/i), {
        target: { files: [pdf] },
      });
      fireEvent.change(screen.getByLabelText(/Contrato social/i), {
        target: { files: [pdf] },
      });
      clickContinue();

      await waitFor(() => {
        expectWizardProgress(5);
      });

      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/i }));

      await waitFor(() => {
        expect(kycApi.uploadKycDocument).toHaveBeenCalledTimes(3);
        expect(kycApi.uploadKycDocument).toHaveBeenCalledWith(
          "provider-1",
          "legal-rep-id",
          expect.any(File),
        );
        expect(kycApi.uploadKycDocument).toHaveBeenCalledWith(
          "provider-1",
          "address-proof",
          expect.any(File),
        );
        expect(kycApi.uploadKycDocument).not.toHaveBeenCalledWith(
          "provider-1",
          "identity",
          expect.any(File),
        );
        expect(mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: "CNPJ",
            razaoSocial: "Empresa LTDA",
            legalRepFullName: "Maria Silva",
            identityDocStoragePath: expect.any(String),
            legalRepDocStoragePath: expect.any(String),
          }),
        );
        expect(onSubmitted).toHaveBeenCalled();
      });
    },
    15_000,
  );

  it(
    "uploads documents and dispatches KYC on valid CPF submit",
    async () => {
      render(
        <ProviderKycForm
          providerId="provider-1"
          accountEmail="provider@example.com"
          onSubmitted={onSubmitted}
        />,
      );

      await fillIdentityCpfAndContinue();
      await fillBankAndContinue();
      await fillDocumentsCpfAndContinue();

      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/i }));

      await waitFor(() => {
        expect(kycApi.uploadKycDocument).toHaveBeenCalled();
        expect(mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: "CPF",
            fullName: "João Silva",
            bankInstitutionCode: "001",
          }),
        );
        expect(onSubmitted).toHaveBeenCalled();
      });
    },
    15_000,
  );

  it(
    "shows upload error when document upload fails",
    async () => {
      vi.mocked(kycApi.uploadKycDocument).mockResolvedValue({
        path: null,
        signedUrl: null,
        sessionId: null,
        error: "upload failed",
      });

      render(
        <ProviderKycForm
          providerId="provider-1"
          accountEmail="provider@example.com"
        />,
      );

      await fillIdentityCpfAndContinue();
      await fillBankAndContinue();
      await fillDocumentsCpfAndContinue();
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/i }));

      await waitFor(() => {
        expect(screen.getByText("upload failed")).toBeInTheDocument();
      });
      expect(mutateAsync).not.toHaveBeenCalled();
    },
    15_000,
  );

  it("disables continue while dispatch is in flight", async () => {
    dispatchKycIsPending.current = true;

    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    await waitForWizardReady();
    expect(screen.getByRole("button", { name: /^Continuar$/i })).toBeDisabled();
  });

  it("shows dispatch error when mutation rejects", async () => {
    mutateAsync.mockRejectedValue(new Error("dispatch failed"));

    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );

    await fillIdentityCpfAndContinue();
    await fillBankAndContinue();
    await fillDocumentsCpfAndContinue();
    fireEvent.click(screen.getByRole("button", { name: /^Enviar$/i }));

    await waitFor(() => {
      expect(screen.getByText("dispatch failed")).toBeInTheDocument();
    });
  });

  it("navigates back with Voltar", async () => {
    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );
    await goToIdentityStep();
    fireEvent.click(screen.getByRole("button", { name: /^Voltar$/i }));
    await waitFor(() => {
      expectWizardProgress(1);
      expectActiveStep("kyc-step-entity");
    });
  });

  it("shows review summary with selected bank and PIX when provided", async () => {
    render(
      <ProviderKycForm
        providerId="provider-1"
        accountEmail="provider@example.com"
      />,
    );
    await fillIdentityCpfAndContinue();

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText(/Banco do Brasil \(001\)/i));
    fireEvent.change(screen.getByLabelText("Agência"), {
      target: { value: "1234" },
    });
    fireEvent.change(screen.getByLabelText(/Conta com dígito/i), {
      target: { value: "56789-0" },
    });
    fireEvent.change(screen.getByLabelText(/Chave PIX/i), {
      target: { value: "joao@email.com" },
    });
    clickContinue();
    await waitFor(() => {
      expectActiveStep("kyc-step-documents");
    });
    await fillDocumentsCpfAndContinue();

    const review = screen.getByTestId("kyc-step-review");
    expect(within(review).getByText(/Banco do Brasil \(001\)/i)).toBeInTheDocument();
    expect(within(review).getByText("João Silva")).toBeInTheDocument();
    expect(within(review).getByText("joao@email.com")).toBeInTheDocument();
  });
});
