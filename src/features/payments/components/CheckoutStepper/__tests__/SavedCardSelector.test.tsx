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
  }: {
    onSuccess: (result: { paymentTokenId: string; cardBrand: string }) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-card-form"
      onClick={() =>
        onSuccess({ paymentTokenId: "new-token", cardBrand: "VISA" })
      }
    >
      Tokenizar
    </button>
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
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByLabelText(/Visa/i));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
      });
    });
  });
});
