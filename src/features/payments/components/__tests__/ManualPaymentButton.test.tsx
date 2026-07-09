// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManualPaymentButton, ManualPaymentRecovery } from "../ManualPaymentButton";

const mockUsePaymentSchedule = vi.fn();

vi.mock("../../hooks/usePaymentSchedule", () => ({
  usePaymentSchedule: (...args: unknown[]) => mockUsePaymentSchedule(...args),
}));

vi.mock("../ManualPaymentModal", () => ({
  ManualPaymentModal: ({ open }: { open: boolean }) => (
    open ? <div data-testid="manual-payment-modal">Modal</div> : null
  ),
}));

describe("ManualPaymentButton", () => {
  it("is hidden for SCHEDULED, PAID, and CANCELLED states", () => {
    const onClick = vi.fn();

    const { rerender } = render(
      <ManualPaymentButton scheduleState="SCHEDULED" onClick={onClick} />,
    );
    expect(screen.queryByRole("button", { name: /Ajustar pagamento/i })).toBeNull();

    rerender(<ManualPaymentButton scheduleState="PAID" onClick={onClick} />);
    expect(screen.queryByRole("button", { name: /Ajustar pagamento/i })).toBeNull();

    rerender(<ManualPaymentButton scheduleState="CANCELLED" onClick={onClick} />);
    expect(screen.queryByRole("button", { name: /Ajustar pagamento/i })).toBeNull();
  });

  it("renders for FAILED and FAILED_PERMANENT states", () => {
    const onClick = vi.fn();

    render(<ManualPaymentButton scheduleState="FAILED" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: /Ajustar pagamento/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("ManualPaymentRecovery", () => {
  it("opens modal when schedule and context are available", () => {
    mockUsePaymentSchedule.mockReturnValue({
      isLoading: false,
      data: {
        schedule: {
          id: "sched-1",
          state: "FAILED",
          contractedServiceId: "service-1",
          paymentTokenId: "token-1",
          installmentNumber: 1,
          baseAmount: 100,
          failureReason: null,
          failureCode: null,
          isDisputed: false,
          paidAt: null,
        },
        context: {
          acceptedProposalId: "proposal-1",
          serviceRequestId: "request-1",
        },
      },
      refetch: vi.fn(),
    });

    render(
      <ManualPaymentRecovery
        contractedServiceId="service-1"
        serviceRequestId="request-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ajustar pagamento/i }));
    expect(screen.getByTestId("manual-payment-modal")).toBeInTheDocument();
    expect(screen.getByText("Pagamento falhou")).toBeInTheDocument();
    expect(
      screen.getByText(/cancelado automaticamente perto da data agendada/i),
    ).toBeInTheDocument();
  });

  it("does not render modal when schedule context is missing", () => {
    mockUsePaymentSchedule.mockReturnValue({
      isLoading: false,
      data: {
        schedule: {
          id: "sched-1",
          state: "FAILED",
          contractedServiceId: "service-1",
          paymentTokenId: "token-1",
          installmentNumber: 1,
          baseAmount: 100,
          failureReason: null,
          failureCode: null,
          isDisputed: false,
          paidAt: null,
        },
        context: null,
      },
      refetch: vi.fn(),
    });

    render(
      <ManualPaymentRecovery
        contractedServiceId="service-1"
        serviceRequestId="request-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ajustar pagamento/i }));
    expect(screen.queryByTestId("manual-payment-modal")).toBeNull();
  });

  it("disables recovery button while schedule is loading", () => {
    mockUsePaymentSchedule.mockReturnValue({
      isLoading: true,
      data: {
        schedule: {
          id: "sched-1",
          state: "FAILED",
          contractedServiceId: "service-1",
          paymentTokenId: "token-1",
          installmentNumber: 1,
          baseAmount: 100,
          failureReason: null,
          failureCode: null,
          isDisputed: false,
          paidAt: null,
        },
        context: {
          acceptedProposalId: "proposal-1",
          serviceRequestId: "request-1",
        },
      },
      refetch: vi.fn(),
    });

    render(
      <ManualPaymentRecovery
        contractedServiceId="service-1"
        serviceRequestId="request-1"
      />,
    );

    expect(screen.getByRole("button", { name: /Ajustar pagamento/i })).toBeDisabled();
  });
});

