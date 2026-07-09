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

vi.mock("@/features/payments/components/AddCardSheetDialog", () => ({
  AddCardSheetDialog: ({
    open,
    onSuccess,
    onOpenChange,
  }: {
    open: boolean;
    onSuccess: (result: {
      paymentTokenId: string;
      cardNumberMasked: string;
      cardBrand: string;
    }) => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Adicionar cartão">
        <button
          type="button"
          data-testid="card-form"
          onClick={() => {
            onSuccess({
              paymentTokenId: "new-token",
              cardNumberMasked: "•••• 9999",
              cardBrand: "VISA",
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

    fireEvent.click(screen.getByRole("button", { name: /Entendi/i }));
    await waitFor(() => {
      expect(
        screen.queryByText(/vinculado a 1 pagamento\(s\) pendente\(s\)/i),
      ).not.toBeInTheDocument();
    });
  });

  it("shows loading and empty states", () => {
    mockUseSavedCards.mockReturnValue({
      cards: [],
      isLoading: true,
      revokeCard,
      isRevoking: false,
      revokingTokenId: null,
      refetch: vi.fn(),
    });

    const { rerender } = render(<SavedCardsList tokenizeContext="profile" />);
    expect(screen.getByText(/Carregando cartões/i)).toBeInTheDocument();

    mockUseSavedCards.mockReturnValue({
      cards: [],
      isLoading: false,
      revokeCard,
      isRevoking: false,
      revokingTokenId: null,
      refetch: vi.fn(),
    });
    rerender(<SavedCardsList tokenizeContext="profile" />);
    expect(screen.getByText("Nenhum cartão salvo ainda.")).toBeInTheDocument();
  });

  it("opens add card sheet and handles successful add", async () => {
    const refetch = vi.fn();
    mockUseSavedCards.mockReturnValue({
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
      refetch,
    });

    const { toast } = await import("sonner");
    render(<SavedCardsList tokenizeContext="profile" />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar Cartão/i }));
    expect(screen.getByRole("dialog", { name: /Adicionar cartão/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(screen.queryByRole("dialog", { name: /Adicionar cartão/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Adicionar Cartão/i }));
    fireEvent.click(screen.getByTestId("card-form"));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Cartão adicionado com sucesso.");
    });
  });

  it("defaults tokenizeContext to checkout when providerServiceId is set", () => {
    mockUseSavedCards.mockReturnValue({
      cards: [],
      isLoading: false,
      revokeCard,
      isRevoking: false,
      revokingTokenId: null,
      refetch: vi.fn(),
    });

    render(<SavedCardsList providerServiceId="proposal-1" phone="48999999999" />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar Cartão/i }));
    expect(screen.getByRole("dialog", { name: /Adicionar cartão/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar cartão/i })).toBeInTheDocument();
  });

  it("shows generic revoke error when thrown value is not an Error", async () => {
    const { toast } = await import("sonner");
    revokeCard.mockRejectedValue("fail");

    render(<SavedCardsList tokenizeContext="profile" />);

    fireEvent.click(
      screen.getByRole("button", { name: /Remover cartão •••• 4444/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível remover este cartão. Tente novamente.",
      );
    });
  });

  it("shows spinner while a specific card is being revoked", () => {
    mockUseSavedCards.mockReturnValue({
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
      isRevoking: true,
      revokingTokenId: "token-free",
      refetch: vi.fn(),
    });

    render(<SavedCardsList tokenizeContext="profile" />);
    expect(
      screen.getByRole("button", { name: /Remover cartão •••• 4444/i }),
    ).toBeDisabled();
  });

  it("shows error toast when revoke returns not_found", async () => {
    const { toast } = await import("sonner");
    revokeCard.mockResolvedValue({ outcome: "not_found" });

    render(<SavedCardsList tokenizeContext="profile" />);

    fireEvent.click(
      screen.getByRole("button", { name: /Remover cartão •••• 1111/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Não foi possível remover este cartão.");
    });
  });

  it("shows error toast when revoke throws", async () => {
    const { toast } = await import("sonner");
    revokeCard.mockRejectedValue(new Error("revoke failed"));

    render(<SavedCardsList tokenizeContext="profile" />);

    fireEvent.click(
      screen.getByRole("button", { name: /Remover cartão •••• 4444/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível remover este cartão. Tente novamente.",
      );
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
