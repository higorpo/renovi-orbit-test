// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ManualPaymentModal } from "../ManualPaymentModal";
import type { PaymentScheduleSummary } from "../../types/paymentSchedule.types";

vi.mock("../../hooks/useClientCpfForPayment", () => ({
  useClientCpfForPayment: () => ({ cpf: "390.533.447-05", isLoading: false, error: null }),
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ profile: { phone: "(48) 99999-9999" } }),
}));

const mockCardStepGenerateSession = vi.fn(() => true);

vi.mock("../CheckoutStepper/CardStep", () => ({
  CardStep: ({
    onSessionIdGenerated,
  }: {
    onSessionIdGenerated: (sessionId: string) => void;
  }) => {
    // Avoid setState-during-render warning from the real CardStep pattern.
    if (mockCardStepGenerateSession()) {
      queueMicrotask(() => onSessionIdGenerated("fresh-session-id"));
    }
    return <div data-testid="checkout-card-step" />;
  },
}));

const fetchPaymentTokenById = vi.fn().mockResolvedValue({
  data: {
    id: "token-1",
    card_number_masked: "411111XXXXXX1111",
    card_brand: "VISA",
    expiry_month: 12,
    expiry_year: 2030,
    state: "ACTIVE",
  },
  error: null,
});

const updatePaymentMethod = vi.fn();

vi.mock("../../api/cards.api", () => ({
  fetchPaymentTokenById: (...args: unknown[]) => fetchPaymentTokenById(...args),
  updatePaymentMethod: (...args: unknown[]) => updatePaymentMethod(...args),
}));

vi.mock("../CheckoutStepper/SavedCardSelector", () => ({
  SavedCardSelector: ({
    onSelect,
    onBack,
  }: {
    onSelect: (selection: { paymentTokenId: string; cardBrand: string }) => void;
    onBack?: () => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onSelect({ paymentTokenId: "token-2", cardBrand: "MASTER" })}
      >
        Selecionar outro cartão
      </button>
      {onBack ? (
        <button type="button" onClick={onBack}>
          Voltar
        </button>
      ) : null}
    </div>
  ),
}));

const mockUseInstallmentOptions = vi.fn(() => ({
  data: {
    installment_options: [
      {
        installment_number: 1,
        applicable_rate_pct: 0,
        total_with_fees: 150,
        installment_amount: 150,
      },
    ],
    installment_selection_hmac: "hmac",
    expires_at: "2030-01-01T00:00:00.000Z",
  },
  isLoading: false,
}));

vi.mock("../../hooks/useInstallmentOptions", () => ({
  useInstallmentOptions: (...args: unknown[]) => mockUseInstallmentOptions(...args),
}));

const manualChargeMutateAsync = vi.fn();
const manualChargeIsPending = { current: false };

vi.mock("../../hooks/useManualChargePayment", () => ({
  useManualChargePayment: () => ({
    mutateAsync: manualChargeMutateAsync,
    get isPending() {
      return manualChargeIsPending.current;
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

const schedule: PaymentScheduleSummary = {
  id: "schedule-1",
  contractedServiceId: "service-1",
  state: "FAILED",
  paymentTokenId: "token-1",
  installmentNumber: 1,
  baseAmount: 150,
  failureReason: "Cartão recusado",
  failureCode: "CARD_DECLINED",
  isDisputed: false,
  paidAt: null,
};

describe("ManualPaymentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    manualChargeIsPending.current = false;
    mockCardStepGenerateSession.mockReturnValue(true);
    mockUseInstallmentOptions.mockReturnValue({
      data: {
        installment_options: [
          {
            installment_number: 1,
            applicable_rate_pct: 0,
            total_with_fees: 150,
            installment_amount: 150,
          },
        ],
        installment_selection_hmac: "hmac",
        expires_at: "2030-01-01T00:00:00.000Z",
      },
      isLoading: false,
    });
    manualChargeMutateAsync.mockResolvedValue({
      scheduleId: "schedule-1",
      outcome: "FAILED_PERMANENT",
      chargeAmount: "150.00",
    });
  });

  it("generates a fresh ClearSale session id when opened", async () => {
    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("checkout-card-step")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /Confirmar pagamento/i }),
    ).not.toBeDisabled();
  });

  it("shows try different card option after terminal charge failure", async () => {
    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/•••• 1111/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Tentar com outro cartão/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Tentar com outro cartão/i }));
    expect(screen.getByText(/Trocar cartão/i)).toBeInTheDocument();
  });

  it("shows base amount when installment option is unavailable", async () => {
    mockUseInstallmentOptions.mockReturnValue({
      data: {
        installment_options: [],
        installment_selection_hmac: "hmac",
        expires_at: "2030-01-01T00:00:00.000Z",
      },
      isLoading: false,
    });

    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Valor base/i)).toBeInTheDocument();
    });
  });

  it("shows fallback copy when base amount is also missing", async () => {
    mockUseInstallmentOptions.mockReturnValue({
      data: {
        installment_options: [],
        installment_selection_hmac: "hmac",
        expires_at: "2030-01-01T00:00:00.000Z",
      },
      isLoading: false,
    });

    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={{ ...schedule, baseAmount: null }}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Confirme o cartão para calcular o valor com taxas/i),
      ).toBeInTheDocument();
    });
  });

  it("shows calculating value while installments load", async () => {
    mockUseInstallmentOptions.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Calculando valor/i)).toBeInTheDocument();
    });
  });

  it("keeps confirm disabled until ClearSale session is ready", async () => {
    mockCardStepGenerateSession.mockReturnValue(false);

    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/•••• 1111/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /Confirmar pagamento/i }),
    ).toBeDisabled();
  });

  it("shows missing card message when schedule has no token", async () => {
    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={{ ...schedule, paymentTokenId: null }}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Nenhum cartão vinculado/i)).toBeInTheDocument();
    });
  });

  it("toasts analysis message for IN_ANALYSIS outcome", async () => {
    const onOpenChange = vi.fn();
    manualChargeMutateAsync.mockResolvedValue({
      scheduleId: "schedule-1",
      outcome: "IN_ANALYSIS",
      chargeAmount: "150.00",
    });

    render(
      <ManualPaymentModal
        open
        onOpenChange={onOpenChange}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar pagamento/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Pagamento em análise. Você será notificado em breve.",
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("toasts generic error for non-terminal charge failures", async () => {
    manualChargeMutateAsync.mockRejectedValue(new Error("timeout"));

    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar pagamento/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível processar o pagamento. Tente novamente.",
      );
    });
  });

  it("toasts success and closes on PAID outcome", async () => {
    const onOpenChange = vi.fn();
    const onCompleted = vi.fn();
    manualChargeMutateAsync.mockResolvedValue({
      scheduleId: "schedule-1",
      outcome: "PAID",
      chargeAmount: "150.00",
    });

    render(
      <ManualPaymentModal
        open
        onOpenChange={onOpenChange}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
        onCompleted={onCompleted}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar pagamento/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Pagamento realizado com sucesso!");
    });
    expect(onCompleted).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows service cancelled view for SERVICE_AUTO_CANCELLED", async () => {
    const onOpenChange = vi.fn();
    const error = new Error("cancelled") as Error & { errorCode?: string };
    error.errorCode = "SERVICE_AUTO_CANCELLED";
    manualChargeMutateAsync.mockRejectedValue(error);

    render(
      <ManualPaymentModal
        open
        onOpenChange={onOpenChange}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar pagamento/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(screen.getByText("Serviço cancelado")).toBeInTheDocument();
    });

    // Dialog chrome also exposes a sr-only "Fechar"; prefer the primary action.
    const [primaryClose] = screen.getAllByRole("button", { name: "Fechar" });
    fireEvent.click(primaryClose);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes from terminal error support action", async () => {
    const onOpenChange = vi.fn();
    render(
      <ManualPaymentModal
        open
        onOpenChange={onOpenChange}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar pagamento/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Falar com suporte/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Falar com suporte/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("updates card from change-card view", async () => {
    updatePaymentMethod.mockResolvedValue({ data: { scheduleId: "schedule-1" }, error: null });
    fetchPaymentTokenById
      .mockResolvedValueOnce({
        data: {
          id: "token-1",
          card_number_masked: "411111XXXXXX1111",
          card_brand: "VISA",
          expiry_month: 12,
          expiry_year: 2030,
          state: "ACTIVE",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "token-2",
          card_number_masked: "555555XXXXXX4444",
          card_brand: "MASTER",
          expiry_month: 6,
          expiry_year: 2029,
          state: "ACTIVE",
        },
        error: null,
      });

    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/•••• 1111/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Trocar cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /Selecionar outro cartão/i }));

    await waitFor(() => {
      expect(updatePaymentMethod).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Cartão atualizado.");
    });
  });

  it("toasts when updatePaymentMethod fails", async () => {
    updatePaymentMethod.mockResolvedValue({ data: null, error: "update failed" });
    fetchPaymentTokenById.mockResolvedValue({
      data: {
        id: "token-1",
        card_number_masked: "411111XXXXXX1111",
        card_brand: "VISA",
        expiry_month: 12,
        expiry_year: 2030,
        state: "ACTIVE",
      },
      error: null,
    });

    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/•••• 1111/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Trocar cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /Selecionar outro cartão/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível atualizar o cartão. Tente novamente.",
      );
    });
  });

  it("closes from cancel on confirm view", async () => {
    const onOpenChange = vi.fn();
    render(
      <ManualPaymentModal
        open
        onOpenChange={onOpenChange}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("returns to confirm from change-card back action", async () => {
    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/•••• 1111/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Trocar cartão/i }));
    expect(screen.getByText("Trocar cartão")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Voltar$/i }));
    await waitFor(() => {
      expect(screen.getByText("Efetuar pagamento")).toBeInTheDocument();
    });
  });

  it("shows updating card state while payment method changes", async () => {
    let resolveUpdate: (value: { data: { scheduleId: string }; error: null }) => void =
      () => {};
    updatePaymentMethod.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    fetchPaymentTokenById
      .mockResolvedValueOnce({
        data: {
          id: "token-1",
          card_number_masked: "411111XXXXXX1111",
          card_brand: "VISA",
          expiry_month: 12,
          expiry_year: 2030,
          state: "ACTIVE",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "token-2",
          card_number_masked: "555555XXXXXX4444",
          card_brand: "MASTER",
          expiry_month: 6,
          expiry_year: 2029,
          state: "ACTIVE",
        },
        error: null,
      });

    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/•••• 1111/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Trocar cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /Selecionar outro cartão/i }));

    await waitFor(() => {
      expect(screen.getByText(/Atualizando cartão/i)).toBeInTheDocument();
    });

    resolveUpdate({ data: { scheduleId: "schedule-1" }, error: null });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Cartão atualizado.");
    });
  });

  it("shows processing label while manual charge is pending", async () => {
    manualChargeIsPending.current = true;

    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Processando/i })).toBeDisabled();
    });
  });

  it("toasts fallback message when charge error has no message", async () => {
    manualChargeMutateAsync.mockRejectedValue({ errorCode: "UNKNOWN" });

    render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar pagamento/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível processar o pagamento. Tente novamente.",
      );
    });
  });

  it("resets view when modal is closed", async () => {
    const { rerender } = render(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar pagamento/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Tentar com outro cartão/i })).toBeInTheDocument();
    });

    rerender(
      <ManualPaymentModal
        open={false}
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    rerender(
      <ManualPaymentModal
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Efetuar pagamento")).toBeInTheDocument();
    });
  });
});
