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

vi.mock("../CheckoutStepper/CardStep", () => ({
  CardStep: ({
    onSessionIdGenerated,
  }: {
    onSessionIdGenerated: (sessionId: string) => void;
  }) => {
    onSessionIdGenerated("fresh-session-id");
    return <div data-testid="checkout-card-step" />;
  },
}));

vi.mock("../../api/cards.api", () => ({
  fetchPaymentTokenById: vi.fn().mockResolvedValue({
    data: {
      id: "token-1",
      card_number_masked: "411111XXXXXX1111",
      card_brand: "VISA",
      expiry_month: 12,
      expiry_year: 2030,
      state: "ACTIVE",
    },
    error: null,
  }),
}));

vi.mock("../../hooks/useInstallmentOptions", () => ({
  useInstallmentOptions: () => ({
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
  }),
}));

const manualChargeMutateAsync = vi.fn();

vi.mock("../../hooks/useManualChargePayment", () => ({
  useManualChargePayment: () => ({
    mutateAsync: manualChargeMutateAsync,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const schedule: PaymentScheduleSummary = {
  id: "schedule-1",
  contractedServiceId: "service-1",
  state: "FAILED",
  paymentTokenId: "token-1",
  installmentNumber: 1,
  baseAmount: 150,
  failureReason: "Cartão recusado",
  failureCode: "CARD_DECLINED",
};

describe("ManualPaymentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});
