// @vitest-environment happy-dom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { ConfirmationStep } from "../ConfirmationStep";

const mutateAsync = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/features/negotiation-proposals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/negotiation-proposals")>();
  return {
    ...actual,
    useAcceptProposalMutation: () => ({
      mutateAsync,
      isPending: false,
    }),
  };
});

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
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    mutateAsync.mockReset();
  });

  it("shows the scheduled slot in the confirmation summary", () => {
    render(<ConfirmationStep {...defaultProps} />);

    expect(screen.getByText("Agendamento")).toBeInTheDocument();
    expect(screen.getByText(/01\/07\/2026/)).toBeInTheDocument();
  });

  it("shows terms of use agreement note with main-site link", () => {
    render(<ConfirmationStep {...defaultProps} />);

    expect(screen.getByText(/Ao confirmar o pagamento/i)).toBeInTheDocument();
    const termsLink = screen.getByRole("link", { name: /Termos de Uso/i });
    expect(termsLink).toHaveAttribute("href", expect.stringContaining("/juridico/termos-de-uso"));
    expect(termsLink).toHaveAttribute("target", "_blank");
    expect(termsLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows error when clearsale session is missing", async () => {
    render(
      <ConfirmationStep
        {...defaultProps}
        clearsaleSessionId={null}
      />,
    );

    confirmRef.current?.();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Aguarde a inicialização da verificação de segurança.",
      );
    });
  });

  it("shows fallback error for non-Error throws", async () => {
    mutateAsync.mockRejectedValueOnce("boom");

    render(<ConfirmationStep {...defaultProps} />);

    confirmRef.current?.();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Não foi possível confirmar.");
    });
  });

  it("shows generic error for non-signature failures", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("gateway down"));

    render(<ConfirmationStep {...defaultProps} />);

    confirmRef.current?.();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("gateway down");
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
    expect(toast.error).not.toHaveBeenCalled();
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
