import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SavedCardsList } from "../SavedCardsList";

const mockUseSavedCards = vi.fn();

vi.mock("@/features/payments/hooks/useSavedCards", () => ({
  useSavedCards: () => mockUseSavedCards(),
}));

vi.mock("@/features/payments/hooks/useClientCpfForPayment", () => ({
  useClientCpfForPayment: () => ({ cpf: null, isLoading: false, error: null }),
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ profile: { phone: "(48) 99999-9999" } }),
}));

vi.mock("@/features/payments/components/CheckoutStepper/CardForm", () => ({
  CardForm: () => <div data-testid="card-form">Card form</div>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SavedCardsList", () => {
  const revokeCard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSavedCards.mockReturnValue({
      cards: [
        {
          id: "token-linked",
          card_number_masked: "411111XXXXXX1111",
          card_brand: "VISA",
          expiry_month: 12,
          expiry_year: 2030,
          state: "ACTIVE",
        },
        {
          id: "token-free",
          card_number_masked: "555555XXXXXX4444",
          card_brand: "MASTER",
          expiry_month: 6,
          expiry_year: 2029,
          state: "ACTIVE",
        },
      ],
      isLoading: false,
      revokeCard,
      isRevoking: false,
      revokingTokenId: null,
      refetch: vi.fn(),
    });
  });

  it("shows a warning when removal is blocked by a linked schedule", async () => {
    revokeCard.mockResolvedValue({
      outcome: "blocked",
      schedules: [
        {
          scheduleId: "schedule-1",
          contractedServiceId: "service-1",
          state: "SCHEDULED",
        },
      ],
    });

    render(<SavedCardsList tokenizeContext="profile" />);

    fireEvent.click(
      screen.getByRole("button", { name: /Remover cartão •••• 1111/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() => {
      expect(
        screen.getByText(/vinculado a 1 pagamento\(s\) pendente\(s\)/i),
      ).toBeInTheDocument();
    });
  });

  it("removes an unlinked card from the list after revoke succeeds", async () => {
    revokeCard.mockResolvedValue({
      outcome: "revoked",
      paymentTokenId: "token-free",
    });

    mockUseSavedCards
      .mockReturnValueOnce({
        cards: [
          {
            id: "token-free",
            card_number_masked: "555555XXXXXX4444",
            card_brand: "MASTER",
            expiry_month: 6,
            expiry_year: 2029,
            state: "ACTIVE",
          },
        ],
        isLoading: false,
        revokeCard,
        isRevoking: false,
        revokingTokenId: null,
        refetch: vi.fn(),
      })
      .mockReturnValue({
        cards: [],
        isLoading: false,
        revokeCard,
        isRevoking: false,
        revokingTokenId: null,
        refetch: vi.fn(),
      });

    const { rerender } = render(<SavedCardsList tokenizeContext="profile" />);

    fireEvent.click(
      screen.getByRole("button", { name: /Remover cartão •••• 4444/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() => {
      expect(revokeCard).toHaveBeenCalledWith("token-free");
    });

    rerender(<SavedCardsList tokenizeContext="profile" />);

    expect(screen.getByText("Nenhum cartão salvo ainda.")).toBeInTheDocument();
  });
});
