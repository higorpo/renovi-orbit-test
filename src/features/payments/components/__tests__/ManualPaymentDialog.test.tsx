// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ManualPaymentDialog } from "../ManualPaymentDialog";
import type { PaymentScheduleSummary } from "../../types/paymentSchedule.types";
import type { InstallmentSelection } from "../../types/paymentToken.types";

vi.mock("../../hooks/useClientCpfForPayment", () => ({
  useClientCpfForPayment: () => ({ cpf: "390.533.447-05", isLoading: false, error: null }),
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ profile: { phone: "(48) 99999-9999" } }),
}));

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({
    contentRef: { current: null },
    scheduleSync: vi.fn(),
  }),
}));

const mockCardStepGenerateSession = vi.fn(() => true);

vi.mock("../CheckoutStepper/CardStep", () => ({
  CardStep: ({
    onSessionIdGenerated,
  }: {
    onSessionIdGenerated: (sessionId: string) => void;
  }) => {
    if (mockCardStepGenerateSession()) {
      queueMicrotask(() => onSessionIdGenerated("fresh-session-id"));
    }
    return <div data-testid="checkout-card-step" />;
  },
}));

vi.mock("../CheckoutStepper/SavedCardSelector", () => ({
  SavedCardSelector: ({
    onSelect,
    onBack,
  }: {
    onSelect: (selection: {
      paymentTokenId: string;
      cardBrand: string;
      cardNumberMasked?: string;
      expiryMonth?: number;
      expiryYear?: number;
    }) => void;
    onBack?: () => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onSelect({
            paymentTokenId: "token-1",
            cardBrand: "VISA",
            cardNumberMasked: "411111XXXXXX1111",
            expiryMonth: 12,
            expiryYear: 2030,
          })
        }
      >
        Selecionar cartão
      </button>
      {onBack ? (
        <button type="button" onClick={onBack}>
          Voltar do cartão
        </button>
      ) : null}
    </div>
  ),
}));

const installmentSelection: InstallmentSelection = {
  installmentNumber: 2,
  installmentSelectionHmac: "hmac",
  installmentHmacPayload: {
    proposal_id: "proposal-1",
    service_id: "sr-1",
    base_amount: 150,
    card_brand: "VISA",
    installment_options: [],
    computed_at: "2030-01-01T00:00:00.000Z",
    expires_at: "2030-01-01T00:00:00.000Z",
  },
  installmentAmount: 80,
  totalWithFees: 160,
  installmentOptions: [],
  computedAt: "2030-01-01T00:00:00.000Z",
  expiresAt: "2030-01-01T00:00:00.000Z",
};

vi.mock("../InstallmentSelector", () => ({
  InstallmentSelector: ({
    onSelect,
    onBack,
  }: {
    onSelect: (selection: InstallmentSelection) => void;
    onBack?: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSelect(installmentSelection)}>
        Selecionar parcelas
      </button>
      {onBack ? (
        <button type="button" onClick={onBack}>
          Voltar das parcelas
        </button>
      ) : null}
    </div>
  ),
}));

const updatePaymentMethod = vi.fn();

vi.mock("../../api/cards.api", () => ({
  updatePaymentMethod: (...args: unknown[]) => updatePaymentMethod(...args),
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

async function goToConfirmView() {
  render(
    <ManualPaymentDialog
      open
      onOpenChange={vi.fn()}
      schedule={schedule}
      acceptedProposalId="proposal-1"
      serviceRequestId="sr-1"
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /Selecionar cartão/i }));
  fireEvent.click(screen.getByRole("button", { name: /Selecionar parcelas/i }));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Confirmar pagamento/i })).toBeInTheDocument();
  });
}

describe("ManualPaymentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    manualChargeIsPending.current = false;
    mockCardStepGenerateSession.mockReturnValue(true);
    updatePaymentMethod.mockResolvedValue({ data: { scheduleId: "schedule-1" }, error: null });
    manualChargeMutateAsync.mockResolvedValue({
      scheduleId: "schedule-1",
      outcome: "FAILED_PERMANENT",
      chargeAmount: "160.00",
    });
  });

  it("starts on card selection and advances to installments then confirm", async () => {
    render(
      <ManualPaymentDialog
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    expect(screen.getByText("Efetuar pagamento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Selecionar cartão/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Selecionar cartão/i }));
    expect(screen.getByText("Parcelamento")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Selecionar parcelas/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Confirmar pagamento" })).toBeInTheDocument();
      expect(screen.getByText(/2x de/i)).toBeInTheDocument();
      expect(screen.getByText(/•••• 1111/i)).toBeInTheDocument();
    });
  });

  it("updates payment method then charges on confirm", async () => {
    const onOpenChange = vi.fn();
    const onCompleted = vi.fn();
    manualChargeMutateAsync.mockResolvedValue({
      scheduleId: "schedule-1",
      outcome: "PAID",
      chargeAmount: "160.00",
    });

    render(
      <ManualPaymentDialog
        open
        onOpenChange={onOpenChange}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
        onCompleted={onCompleted}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Selecionar cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /Selecionar parcelas/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar pagamento/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(updatePaymentMethod).toHaveBeenCalledWith({
        contractedServiceId: "service-1",
        newPaymentTokenId: "token-1",
        installmentNumber: 2,
        installmentSelectionHmac: "hmac",
        installmentHmacPayload: installmentSelection.installmentHmacPayload,
      });
      expect(manualChargeMutateAsync).toHaveBeenCalledWith({
        scheduleId: "schedule-1",
        clearsaleSessionId: "fresh-session-id",
      });
      expect(toast.success).toHaveBeenCalledWith("Pagamento realizado com sucesso!");
    });
    expect(onCompleted).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows terminal error and allows retry with another card", async () => {
    await goToConfirmView();

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Tentar com outro cartão/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Tentar com outro cartão/i }));
    expect(screen.getByRole("button", { name: /Selecionar cartão/i })).toBeInTheDocument();
  });

  it("shows service cancelled view for SERVICE_AUTO_CANCELLED", async () => {
    const error = new Error("cancelled") as Error & { errorCode?: string };
    error.errorCode = "SERVICE_AUTO_CANCELLED";
    manualChargeMutateAsync.mockRejectedValue(error);

    await goToConfirmView();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(screen.getByText("Serviço cancelado")).toBeInTheDocument();
    });
  });

  it("toasts when updatePaymentMethod fails and does not charge", async () => {
    updatePaymentMethod.mockResolvedValue({ data: null, error: "update failed", errorCode: "UPDATE_FAILED" });

    await goToConfirmView();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(manualChargeMutateAsync).not.toHaveBeenCalled();
  });

  it("returns to installments when HMAC expired on update", async () => {
    updatePaymentMethod.mockResolvedValue({
      data: null,
      error: "expired",
      errorCode: "INSTALLMENT_SIGNATURE_EXPIRED",
    });

    await goToConfirmView();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(screen.getByText("Parcelamento")).toBeInTheDocument();
    });
  });

  it("keeps confirm disabled until ClearSale session is ready", async () => {
    mockCardStepGenerateSession.mockReturnValue(false);

    render(
      <ManualPaymentDialog
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Selecionar cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /Selecionar parcelas/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar pagamento/i })).toBeDisabled();
    });
  });

  it("resets to card view when dialog is reopened", async () => {
    const { rerender } = render(
      <ManualPaymentDialog
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Selecionar cartão/i }));
    expect(screen.getByText("Parcelamento")).toBeInTheDocument();

    rerender(
      <ManualPaymentDialog
        open={false}
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    rerender(
      <ManualPaymentDialog
        open
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Efetuar pagamento")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Selecionar cartão/i })).toBeInTheDocument();
    });
  });
});
