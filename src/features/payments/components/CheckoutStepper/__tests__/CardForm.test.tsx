// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as tokenizeApi from "../../../api/cards.api";
import { CardForm } from "../CardForm";

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
  street: "Rua das Flores",
  number: "100",
  additionalDetails: "Apto 12",
  district: "Centro",
  city: "Florianópolis",
  state: "SC",
  zipCode: "88000-000",
};

function fillCardForm() {
  fireEvent.change(screen.getByLabelText("Número do cartão"), {
    target: { value: validForm.cardNumber },
  });
  fireEvent.change(screen.getByLabelText("Mês"), {
    target: { value: validForm.expiryMonth },
  });
  fireEvent.change(screen.getByLabelText("Ano"), {
    target: { value: validForm.expiryYear },
  });
  fireEvent.change(screen.getByLabelText("CVV"), {
    target: { value: validForm.cvv },
  });
  fireEvent.change(screen.getByLabelText("Nome no cartão"), {
    target: { value: validForm.cardholderName },
  });
  fireEvent.change(screen.getByLabelText("Logradouro"), {
    target: { value: validForm.street },
  });
  fireEvent.change(screen.getByLabelText("Número"), {
    target: { value: validForm.number },
  });
  fireEvent.change(screen.getByLabelText("Complemento"), {
    target: { value: validForm.additionalDetails },
  });
  fireEvent.change(screen.getByLabelText("Bairro"), {
    target: { value: validForm.district },
  });
  fireEvent.change(screen.getByLabelText("Cidade"), {
    target: { value: validForm.city },
  });
  fireEvent.change(screen.getByLabelText("UF"), {
    target: { value: validForm.state },
  });
  fireEvent.change(screen.getByLabelText("CEP"), {
    target: { value: validForm.zipCode },
  });
}

describe("CardForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
      <CardForm providerServiceId="provider-service-1" onSuccess={onSuccess} />,
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
});
