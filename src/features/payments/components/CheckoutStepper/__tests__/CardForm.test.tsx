// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import * as tokenizeApi from "../../../api/cards.api";
import { CardForm } from "../CardForm";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const validForm = {
  cardNumber: "4111 1111 1111 1111",
  expiryMonth: "12",
  expiryYear: "2030",
  cvv: "123",
  cardholderName: "Maria Silva",
  cardholderCpf: "390.533.447-05",
  street: "Rua das Flores",
  number: "100",
  additionalDetails: "Apto 12",
  district: "Centro",
  city: "Florianópolis",
  state: "SC",
  zipCode: "88000-000",
};

function fillCardForm(overrides?: Partial<typeof validForm>) {
  const values = { ...validForm, ...overrides };
  fireEvent.change(screen.getByLabelText("Número do cartão"), {
    target: { value: values.cardNumber },
  });
  fireEvent.change(screen.getByLabelText("Mês"), {
    target: { value: values.expiryMonth },
  });
  fireEvent.change(screen.getByLabelText("Ano"), {
    target: { value: values.expiryYear },
  });
  fireEvent.change(screen.getByLabelText("CVV"), {
    target: { value: values.cvv },
  });
  fireEvent.change(screen.getByLabelText("Nome no cartão"), {
    target: { value: values.cardholderName },
  });
  fireEvent.change(screen.getByLabelText("CPF do titular do cartão"), {
    target: { value: values.cardholderCpf },
  });
  fireEvent.change(screen.getByLabelText("Logradouro"), {
    target: { value: values.street },
  });
  fireEvent.change(screen.getByLabelText("Número"), {
    target: { value: values.number },
  });
  fireEvent.change(screen.getByLabelText("Complemento"), {
    target: { value: values.additionalDetails },
  });
  fireEvent.change(screen.getByLabelText("Bairro"), {
    target: { value: values.district },
  });
  fireEvent.change(screen.getByLabelText("Cidade"), {
    target: { value: values.city },
  });
  fireEvent.change(screen.getByLabelText("UF"), {
    target: { value: values.state },
  });
  fireEvent.change(screen.getByLabelText("CEP"), {
    target: { value: values.zipCode },
  });
}

describe("CardForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  it("clears sensitive fields after successful tokenization", async () => {
    vi.spyOn(tokenizeApi, "tokenizePaymentCard").mockResolvedValue({
      data: {
        paymentTokenId: "token-1",
        cardNumberMasked: "•••• 1111",
        cardBrand: "VISA",
      },
      error: null,
    });

    const onSuccess = vi.fn();

    render(
      <CardForm
        providerServiceId="provider-service-1"
        savedCpf="390.533.447-05"
        phone="(48) 99999-9999"
        onSuccess={onSuccess}
      />,
      { wrapper: createWrapper() },
    );

    fillCardForm();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByLabelText("Número do cartão")).toHaveValue("");
    expect(screen.getByLabelText("CVV")).toHaveValue("");
    expect(screen.getByLabelText("Nome no cartão")).toHaveValue("");
  });

  it("shows error when phone is missing", async () => {
    render(
      <CardForm
        providerServiceId="provider-service-1"
        savedCpf="390.533.447-05"
        onSuccess={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    fillCardForm();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Informe seu telefone para continuar.");
    });
  });

  it("shows checkout-specific CPF error when saved CPF is missing", async () => {
    render(
      <CardForm
        providerServiceId="provider-service-1"
        tokenizeContext="checkout"
        phone="(48) 99999-9999"
        onSuccess={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    fillCardForm();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Complete a etapa de CPF antes de continuar.");
    });
  });

  it("shows checkout phone error when phone is missing", async () => {
    render(
      <CardForm
        providerServiceId="provider-service-1"
        tokenizeContext="checkout"
        savedCpf="390.533.447-05"
        onSuccess={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    fillCardForm();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Complete a etapa de telefone antes de continuar.");
    });
  });

  it("shows generic tokenize error when mutation throws a non-Error", async () => {
    vi.spyOn(tokenizeApi, "tokenizePaymentCard").mockRejectedValue("boom");

    render(
      <CardForm
        providerServiceId="provider-service-1"
        savedCpf="390.533.447-05"
        phone="(48) 99999-9999"
        onSuccess={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    fillCardForm();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível salvar o cartão. Verifique os dados e tente novamente.",
      );
    });
  });

  it("shows tokenize error from mutation failure", async () => {
    vi.spyOn(tokenizeApi, "tokenizePaymentCard").mockResolvedValue({
      data: null,
      error: "Seu cartão foi recusado. Tente outro cartão ou entre em contato com o emissor.",
    });

    render(
      <CardForm
        providerServiceId="provider-service-1"
        savedCpf="390.533.447-05"
        phone="(48) 99999-9999"
        onSuccess={vi.fn()}
        onBack={vi.fn()}
        submitLabel="Salvar cartão"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("button", { name: /Voltar/i })).toBeInTheDocument();

    fillCardForm();
    fireEvent.click(screen.getByRole("button", { name: "Salvar cartão" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/recusado/i),
      );
    });
  });

  it("shows profile CPF error when saved CPF is missing", async () => {
    render(
      <CardForm
        providerServiceId="provider-service-1"
        tokenizeContext="profile"
        phone="(48) 99999-9999"
        onSuccess={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    fillCardForm();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Cadastre seu CPF na conta antes de adicionar um cartão.",
      );
    });
  });

  it("shows pending submit label while tokenizing", async () => {
    let resolveTokenize: (value: {
      data: { paymentTokenId: string; cardNumberMasked: string; cardBrand: string };
      error: null;
    }) => void = () => {};

    vi.spyOn(tokenizeApi, "tokenizePaymentCard").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTokenize = resolve;
        }),
    );

    render(
      <CardForm
        providerServiceId="provider-service-1"
        savedCpf="390.533.447-05"
        phone="(48) 99999-9999"
        onSuccess={vi.fn()}
        onBack={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    fillCardForm();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Salvando cartão/i })).toBeDisabled();
    });

    resolveTokenize({
      data: {
        paymentTokenId: "token-1",
        cardNumberMasked: "•••• 1111",
        cardBrand: "VISA",
      },
      error: null,
    });
  });

  it("sends cardholder CPF to tokenize even when it differs from account CPF", async () => {
    const tokenizeSpy = vi.spyOn(tokenizeApi, "tokenizePaymentCard").mockResolvedValue({
      data: {
        paymentTokenId: "token-1",
        cardNumberMasked: "•••• 1111",
        cardBrand: "VISA",
      },
      error: null,
    });

    render(
      <CardForm
        providerServiceId="provider-service-1"
        savedCpf="390.533.447-05"
        phone="(48) 99999-9999"
        onSuccess={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    fillCardForm({ cardholderCpf: "529.982.247-25" });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(tokenizeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cpf: "52998224725",
        }),
      );
    });
  });

  it("scrolls to the first invalid field when validation fails", async () => {
    const scrollIntoView = vi.fn();
    const scrollSpy = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(scrollIntoView);

    try {
      render(
        <CardForm
          providerServiceId="provider-service-1"
          savedCpf="390.533.447-05"
          phone="(48) 99999-9999"
          onSuccess={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText(/Informe o número do cartão/i)).toBeInTheDocument();
      });

      expect(scrollIntoView).toHaveBeenCalled();
      expect(document.activeElement).toBe(screen.getByLabelText("Número do cartão"));
    } finally {
      scrollSpy.mockRestore();
    }
  });

  it("shows soft warning when first name differs from account name", async () => {
    render(
      <CardForm
        providerServiceId="provider-service-1"
        savedCpf="390.533.447-05"
        accountFullName="Maria Silva"
        phone="(48) 99999-9999"
        onSuccess={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const nameInput = screen.getByLabelText("Nome no cartão");
    fireEvent.change(nameInput, {
      target: { value: "João Silva" },
    });

    await waitFor(() => {
      expect(nameInput).toHaveValue("João Silva");
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Aconselhamos usar um cartão de titularidade/i),
      ).toBeInTheDocument();
    });
  });
});
