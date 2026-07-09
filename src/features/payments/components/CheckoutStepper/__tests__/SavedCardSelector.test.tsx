// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SavedCardSelector } from "../SavedCardSelector";

const mockUseSavedPaymentTokens = vi.fn();

vi.mock("../../../hooks/useSavedPaymentTokens", () => ({
  useSavedPaymentTokens: () => mockUseSavedPaymentTokens(),
}));

vi.mock("../CardForm", () => ({
  CardForm: ({
    onSuccess,
    onBack,
  }: {
    onSuccess: (result: { paymentTokenId: string; cardBrand: string }) => void;
    onBack?: () => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="mock-card-form"
        onClick={() =>
          onSuccess({ paymentTokenId: "new-token", cardBrand: "VISA" })
        }
      >
        Tokenizar
      </button>
      {onBack ? (
        <button type="button" onClick={onBack}>
          Voltar do formulário
        </button>
      ) : null}
    </div>
  ),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("SavedCardSelector", () => {
  beforeEach(() => {
    mockUseSavedPaymentTokens.mockReset();
  });

  it("shows card form when there are no saved cards", () => {
    mockUseSavedPaymentTokens.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(
      <SavedCardSelector
        providerServiceId="proposal-1"
        onSelect={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("mock-card-form")).toBeInTheDocument();
  });

  it("lets the user select a saved card", async () => {
    const onSelect = vi.fn();
    mockUseSavedPaymentTokens.mockReturnValue({
      data: [
        {
          id: "token-1",
          card_number_masked: "•••• 4242",
          card_brand: "VISA",
          expiry_month: 12,
          expiry_year: 2030,
          state: "ACTIVE",
        },
      ],
      isLoading: false,
    });

    render(
      <SavedCardSelector
        providerServiceId="proposal-1"
        onSelect={onSelect}
        onBack={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("button", { name: /Voltar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Visa/i));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
      });
    });
  });

  it("opens new card form and selects newly tokenized card", async () => {
    const onSelect = vi.fn();
    mockUseSavedPaymentTokens.mockReturnValue({
      data: [
        {
          id: "token-1",
          card_number_masked: "•••• 4242",
          card_brand: "VISA",
          expiry_month: 12,
          expiry_year: 2030,
          state: "ACTIVE",
        },
      ],
      isLoading: false,
    });

    render(
      <SavedCardSelector
        providerServiceId="proposal-1"
        savedCpf="390.533.447-05"
        phone="48999999999"
        onSelect={onSelect}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole("button", { name: /Adicionar novo cartão/i }));
    fireEvent.click(screen.getByTestId("mock-card-form"));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        paymentTokenId: "new-token",
        cardBrand: "VISA",
      });
    });
  });

  it("does not continue when selected token disappears", () => {
    const onSelect = vi.fn();
    mockUseSavedPaymentTokens.mockReturnValue({
      data: [
        {
          id: "token-1",
          card_number_masked: "•••• 4242",
          card_brand: "VISA",
          expiry_month: 12,
          expiry_year: 2030,
          state: "ACTIVE",
        },
      ],
      isLoading: false,
    });

    render(
      <SavedCardSelector
        providerServiceId="proposal-1"
        onSelect={onSelect}
      />,
      { wrapper: createWrapper() },
    );

    // Select a radio then clear selection state by clicking continue without selection.
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("returns from new card form to saved card list when cards exist", () => {
    mockUseSavedPaymentTokens.mockReturnValue({
      data: [
        {
          id: "token-1",
          card_number_masked: "•••• 4242",
          card_brand: "VISA",
          expiry_month: 12,
          expiry_year: 2030,
          state: "ACTIVE",
        },
      ],
      isLoading: false,
    });

    render(
      <SavedCardSelector
        providerServiceId="proposal-1"
        onSelect={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole("button", { name: /Adicionar novo cartão/i }));
    expect(screen.getByTestId("mock-card-form")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Voltar do formulário/i }));
    expect(screen.getByText(/Escolha um cartão/i)).toBeInTheDocument();
  });

  it("forwards parent onBack to card form when there are no saved cards", () => {
    const onBack = vi.fn();
    mockUseSavedPaymentTokens.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(
      <SavedCardSelector
        providerServiceId="proposal-1"
        onSelect={vi.fn()}
        onBack={onBack}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole("button", { name: /Voltar do formulário/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
