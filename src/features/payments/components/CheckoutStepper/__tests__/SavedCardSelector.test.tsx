// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MutableRefObject, ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SavedCardSelector } from "../SavedCardSelector";

const mockUseSavedPaymentTokens = vi.fn();

vi.mock("../../../hooks/useSavedPaymentTokens", () => ({
  useSavedPaymentTokens: () => mockUseSavedPaymentTokens(),
}));

vi.mock("../../AddCardSheetDialog", () => ({
  AddCardSheetDialog: ({
    open,
    onSuccess,
    onOpenChange,
  }: {
    open: boolean;
    onSuccess: (result: {
      paymentTokenId: string;
      cardBrand: string;
      cardNumberMasked?: string;
    }) => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Adicionar cartão">
        <button
          type="button"
          data-testid="mock-save-card"
          onClick={() => {
            onSuccess({
              paymentTokenId: "new-token",
              cardBrand: "VISA",
              cardNumberMasked: "497010XXXXXX0048",
            });
            onOpenChange(false);
          }}
        >
          Salvar cartão
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Cancelar
        </button>
      </div>
    ) : null,
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

  it("shows empty state CTA when there are no saved cards", () => {
    mockUseSavedPaymentTokens.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(
      <SavedCardSelector providerServiceId="proposal-1" onSelect={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText(/Adicione um cartão/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar novo cartão/i })).toBeInTheDocument();
  });

  it("shows skeleton while saved cards are loading", () => {
    mockUseSavedPaymentTokens.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(
      <SavedCardSelector providerServiceId="proposal-1" onSelect={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("saved-card-selector-skeleton")).toBeInTheDocument();
    expect(screen.getByLabelText(/Carregando cartões/i)).toBeInTheDocument();
  });

  it("lets the parent continue with a selected saved card via continueRef", async () => {
    const onSelect = vi.fn();
    const continueRef: MutableRefObject<(() => void) | null> = { current: null };
    const onCanContinueChange = vi.fn();

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
        continueRef={continueRef}
        onCanContinueChange={onCanContinueChange}
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(onCanContinueChange).toHaveBeenCalledWith(false);
    });

    fireEvent.click(screen.getByLabelText(/Visa/i));

    await waitFor(() => {
      expect(onCanContinueChange).toHaveBeenCalledWith(true);
    });

    continueRef.current?.();

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
        cardNumberMasked: "•••• 4242",
        expiryMonth: 12,
        expiryYear: 2030,
      });
    });
  });

  it("opens add-card sheet and selects newly tokenized card", async () => {
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
    expect(screen.getByRole("dialog", { name: /Adicionar cartão/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar cartão/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-save-card"));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        paymentTokenId: "new-token",
        cardBrand: "VISA",
        cardNumberMasked: "497010XXXXXX0048",
      });
    });
  });

  it("does not continue when no card is selected", () => {
    const onSelect = vi.fn();
    const continueRef: MutableRefObject<(() => void) | null> = { current: null };
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
        continueRef={continueRef}
      />,
      { wrapper: createWrapper() },
    );

    continueRef.current?.();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes add-card sheet on cancel without selecting", () => {
    mockUseSavedPaymentTokens.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(
      <SavedCardSelector providerServiceId="proposal-1" onSelect={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole("button", { name: /Adicionar novo cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(screen.queryByRole("dialog", { name: /Adicionar cartão/i })).toBeNull();
  });
});
