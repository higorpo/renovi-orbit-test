// @vitest-environment happy-dom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationStep } from "../ConfirmationStep";

const mutateAsync = vi.fn();

vi.mock("@/features/negotiation-proposals", () => ({
  useAcceptProposalMutation: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

vi.mock("../../PaymentTrustDisclosure", () => ({
  PaymentTrustDisclosure: () => null,
}));

const confirmRef = { current: null as (() => void) | null };

const defaultProps = {
  serviceTitle: "Pintura interna",
  scheduledDate: "2026-07-01T10:00:00.000Z",
  installmentNumber: 1,
  installmentAmount: 1024.29,
  totalWithFees: 1024.29,
  proposalId: "proposal-1",
  selectedSlot: {
    start_date: "2026-07-01",
    shift: "morning" as const,
  },
  pricingSignature: "pricing-sig",
  paymentTokenId: "token-1",
  clearsaleSessionId: "clearsale-session",
  installmentSelectionHmac: "deadbeef",
  installmentHmacPayload: {
    proposal_id: "proposal-1",
    service_id: "service-1",
    base_amount: 1000,
    card_brand: "VCC",
    installment_options: [{
      installment_number: 1,
      applicable_rate_pct: 2.39,
      total_with_fees: 1024.29,
      installment_amount: 1024.29,
    }],
    computed_at: "2026-06-24T12:00:00.000Z",
    expires_at: "2026-06-24T12:10:00.000Z",
  },
  installmentOptions: [{
    installment_number: 1,
    applicable_rate_pct: 2.39,
    total_with_fees: 1024.29,
    installment_amount: 1024.29,
  }],
  idempotencyKey: "idem-1",
  onSuccess: vi.fn(),
  onInstallmentSignatureExpired: vi.fn(),
  confirmRef,
};

describe("ConfirmationStep", () => {
  it("shows error when clearsale session is missing", async () => {
    render(
      <ConfirmationStep
        {...defaultProps}
        clearsaleSessionId={null}
      />,
    );

    confirmRef.current?.();

    await waitFor(() => {
      expect(
        screen.getByText(/Aguarde a inicialização da verificação de segurança/i),
      ).toBeInTheDocument();
    });
  });

  it("shows fallback error for non-Error throws", async () => {
    mutateAsync.mockRejectedValueOnce("boom");

    render(<ConfirmationStep {...defaultProps} />);

    confirmRef.current?.();

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível confirmar/i)).toBeInTheDocument();
    });
  });

  it("shows generic error for non-signature failures", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("gateway down"));

    render(<ConfirmationStep {...defaultProps} />);

    confirmRef.current?.();

    await waitFor(() => {
      expect(screen.getByText("gateway down")).toBeInTheDocument();
    });
  });

  it("calls onSuccess when accept proposal succeeds", async () => {
    const onSuccess = vi.fn();
    mutateAsync.mockResolvedValueOnce({ contractedServiceId: "service-1" });

    render(
      <ConfirmationStep
        {...defaultProps}
        onSuccess={onSuccess}
      />,
    );

    confirmRef.current?.();

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("service-1");
    });
  });

  it("re-opens installment step on INSTALLMENT_SIGNATURE_EXPIRED while preserving payment token", async () => {
    const onInstallmentSignatureExpired = vi.fn();
    const onSuccess = vi.fn();

    mutateAsync.mockRejectedValueOnce(
      Object.assign(new Error("Assinatura expirada"), {
        code: "INSTALLMENT_SIGNATURE_EXPIRED",
      }),
    );

    render(
      <ConfirmationStep
        {...defaultProps}
        onSuccess={onSuccess}
        onInstallmentSignatureExpired={onInstallmentSignatureExpired}
      />,
    );

    confirmRef.current?.();

    await waitFor(() => {
      expect(onInstallmentSignatureExpired).toHaveBeenCalledTimes(1);
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "proposal-1",
        selectedSlot: defaultProps.selectedSlot,
        paymentTokenId: "token-1",
        pricingSignature: "pricing-sig",
        installmentHmacPayload: defaultProps.installmentHmacPayload,
      }),
    );
  });
});
