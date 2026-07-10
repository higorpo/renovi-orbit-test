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

const mockSavedCardSelection = {
  paymentTokenId: "token-1",
  cardBrand: "VISA",
  cardNumberMasked: "411111XXXXXX1111" as string | undefined,
  expiryMonth: 12 as number | undefined,
  expiryYear: 2030 as number | undefined,
};

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
    onCanContinueChange,
    continueRef,
  }: {
    onSelect: (selection: {
      paymentTokenId: string;
      cardBrand: string;
      cardNumberMasked?: string;
      expiryMonth?: number;
      expiryYear?: number;
    }) => void;
    onCanContinueChange?: (canContinue: boolean) => void;
    continueRef?: { current: (() => void) | null };
  }) => {
    queueMicrotask(() => {
      onCanContinueChange?.(true);
    });
    const selectCard = () =>
      onSelect({
        paymentTokenId: mockSavedCardSelection.paymentTokenId,
        cardBrand: mockSavedCardSelection.cardBrand,
        cardNumberMasked: mockSavedCardSelection.cardNumberMasked,
        expiryMonth: mockSavedCardSelection.expiryMonth,
        expiryYear: mockSavedCardSelection.expiryYear,
      });

    if (continueRef) {
      continueRef.current = selectCard;
    }
    return (
      <div>
        <button type="button" onClick={selectCard}>
          Selecionar cartão
        </button>
      </div>
    );
  },
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
    onCanContinueChange,
    continueRef,
  }: {
    onSelect: (selection: InstallmentSelection) => void;
    onCanContinueChange?: (canContinue: boolean) => void;
    continueRef?: { current: (() => void) | null };
  }) => {
    queueMicrotask(() => {
      onCanContinueChange?.(true);
    });
    if (continueRef) {
      continueRef.current = () => onSelect(installmentSelection);
    }
    return (
      <div>
        <button type="button" onClick={() => onSelect(installmentSelection)}>
          Selecionar parcelas
        </button>
      </div>
    );
  },
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
    mockSavedCardSelection.paymentTokenId = "token-1";
    mockSavedCardSelection.cardBrand = "VISA";
    mockSavedCardSelection.cardNumberMasked = "411111XXXXXX1111";
    mockSavedCardSelection.expiryMonth = 12;
    mockSavedCardSelection.expiryYear = 2030;
    updatePaymentMethod.mockResolvedValue({ data: { scheduleId: "schedule-1" }, error: null });
    manualChargeMutateAsync.mockResolvedValue({
      scheduleId: "schedule-1",
      outcome: "FAILED_PERMANENT",
      chargeAmount: "160.00",
    });
  });

  it("keeps Continuar/Cancelar in the dialog footer on card view and Continuar/Voltar on installments", async () => {
    const onOpenChange = vi.fn();
    render(
      <ManualPaymentDialog
        open
        onOpenChange={onOpenChange}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Continuar$/i })).toBeEnabled();
    });
    expect(screen.getByRole("button", { name: /^Cancelar$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Continuar$/i }));
    expect(screen.getByText("Parcelamento")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Continuar$/i })).toBeEnabled();
    });
    expect(screen.getByRole("button", { name: /^Voltar$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Continuar$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Confirmar pagamento" })).toBeInTheDocument();
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

  it("shows terminal error title, message, support link, and retry action", async () => {
    await goToConfirmView();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Pagamento não concluído" })).toBeInTheDocument();
      expect(
        screen.getByText("Não foi possível concluir o pagamento com este cartão."),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Falar com suporte/i })).toHaveAttribute(
        "href",
        expect.stringContaining("/suporte"),
      );
      expect(screen.getByRole("button", { name: /Tentar com outro cartão/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Tentar com outro cartão/i }));
    expect(screen.getByRole("button", { name: /Selecionar cartão/i })).toBeInTheDocument();
  });

  it("shows service cancelled view with description, support hint, and close action", async () => {
    const onOpenChange = vi.fn();
    const error = new Error("cancelled") as Error & { errorCode?: string };
    error.errorCode = "SERVICE_AUTO_CANCELLED";
    manualChargeMutateAsync.mockRejectedValue(error);

    render(
      <ManualPaymentDialog
        open
        onOpenChange={onOpenChange}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Selecionar cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /Selecionar parcelas/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar pagamento/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Serviço cancelado" })).toBeInTheDocument();
      expect(
        screen.getByText("Este serviço foi cancelado automaticamente por falta de pagamento."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Entre em contato com o suporte se precisar de ajuda."),
      ).toBeInTheDocument();
    });

    const footerClose = screen
      .getAllByRole("button", { name: /^Fechar$/i })
      .find((button) => button.textContent === "Fechar");
    expect(footerClose).toBeDefined();
    fireEvent.click(footerClose!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("navigates from confirm view via Trocar cartão and Alterar parcelas", async () => {
    await goToConfirmView();

    fireEvent.click(screen.getByRole("button", { name: /Trocar cartão/i }));
    expect(screen.getByText("Efetuar pagamento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Selecionar cartão/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Selecionar cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /Selecionar parcelas/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Confirmar pagamento" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Alterar parcelas/i }));
    expect(screen.getByText("Parcelamento")).toBeInTheDocument();
  });

  it("renders confirm card summary without mask or expiry when missing", async () => {
    mockSavedCardSelection.cardNumberMasked = undefined;
    mockSavedCardSelection.expiryMonth = undefined;
    mockSavedCardSelection.expiryYear = undefined;

    await goToConfirmView();

    expect(screen.getByText("Visa")).toBeInTheDocument();
    expect(screen.queryByText(/••••/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Validade/i)).not.toBeInTheDocument();
  });

  it("shows Processando… and disables Voltar while submitting", async () => {
    let resolveUpdate: (value: { data: { scheduleId: string }; error: null }) => void;
    updatePaymentMethod.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    await goToConfirmView();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Processando…/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Voltar$/i })).toBeDisabled();
    });

    resolveUpdate!({ data: { scheduleId: "schedule-1" }, error: null });
  });

  it("closes from card view and navigates back via Voltar footer actions", async () => {
    const onOpenChange = vi.fn();
    render(
      <ManualPaymentDialog
        open
        onOpenChange={onOpenChange}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: /Selecionar cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Voltar$/i }));
    expect(screen.getByText("Efetuar pagamento")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Selecionar cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /Selecionar parcelas/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Confirmar pagamento" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^Voltar$/i }));
    expect(screen.getByText("Parcelamento")).toBeInTheDocument();
  });

  it("does not mount CardStep when dialog is closed", () => {
    render(
      <ManualPaymentDialog
        open={false}
        onOpenChange={vi.fn()}
        schedule={schedule}
        acceptedProposalId="proposal-1"
        serviceRequestId="sr-1"
      />,
    );

    expect(screen.queryByTestId("checkout-card-step")).not.toBeInTheDocument();
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
