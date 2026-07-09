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

vi.mock("../CardForm", () => ({
  CARD_FORM_ID: "payment-card-form",
  CardForm: ({
    onSuccess,
    onBack,
    hideActions,
    formId,
  }: {
    onSuccess: (result: {
      paymentTokenId: string;
      cardBrand: string;
      cardNumberMasked?: string;
    }) => void;
    onBack?: () => void;
    hideActions?: boolean;
    formId?: string;
  }) => (
    <div>
      <form id={formId}>
        <button
          type="button"
          data-testid="mock-card-form"
          onClick={() =>
            onSuccess({
              paymentTokenId: "new-token",
              cardBrand: "VISA",
              cardNumberMasked: "497010XXXXXX0048",
            })
          }
        >
          Tokenizar
        </button>
      </form>
      {hideActions ? null : onBack ? (
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
        onBack={vi.fn()}
        continueRef={continueRef}
        onCanContinueChange={onCanContinueChange}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByRole("button", { name: /Continuar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Voltar$/i })).toBeNull();

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

  it("opens new card form and selects newly tokenized card", async () => {
    const onSelect = vi.fn();
    const onModeChange = vi.fn();
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
        onModeChange={onModeChange}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole("button", { name: /Adicionar novo cartão/i }));
    await waitFor(() => {
      expect(onModeChange).toHaveBeenCalledWith("form");
    });
    fireEvent.click(screen.getByTestId("mock-card-form"));

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

  it("returns from new card form to saved card list via backRef", async () => {
    const backRef: MutableRefObject<(() => void) | null> = { current: null };
    const onCanGoBackChange = vi.fn();
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
        backRef={backRef}
        onCanGoBackChange={onCanGoBackChange}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole("button", { name: /Adicionar novo cartão/i }));
    await waitFor(() => {
      expect(onCanGoBackChange).toHaveBeenCalledWith(true);
      expect(backRef.current).toBeTypeOf("function");
    });

    backRef.current?.();
    await waitFor(() => {
      expect(screen.getByText(/Escolha um cartão/i)).toBeInTheDocument();
    });
  });

  it("forwards parent onBack via backRef when there are no saved cards", async () => {
    const onBack = vi.fn();
    const backRef: MutableRefObject<(() => void) | null> = { current: null };
    mockUseSavedPaymentTokens.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(
      <SavedCardSelector
        providerServiceId="proposal-1"
        onSelect={vi.fn()}
        onBack={onBack}
        backRef={backRef}
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(backRef.current).toBeTypeOf("function");
    });
    backRef.current?.();
    expect(onBack).toHaveBeenCalled();
  });
});
