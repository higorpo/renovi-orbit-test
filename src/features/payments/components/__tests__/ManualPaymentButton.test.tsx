// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManualPaymentButton, ManualPaymentRecovery } from "../ManualPaymentButton";

const mockUsePaymentSchedule = vi.fn();

vi.mock("../../hooks/usePaymentSchedule", () => ({
  usePaymentSchedule: (...args: unknown[]) => mockUsePaymentSchedule(...args),
}));

vi.mock("../ManualPaymentDialog", () => ({
  ManualPaymentDialog: ({
    open,
    onCompleted,
  }: {
    open: boolean;
    onCompleted?: () => void;
  }) => (
    open ? (
      <div data-testid="manual-payment-dialog">
        <button type="button" onClick={() => onCompleted?.()}>
          complete-payment
        </button>
      </div>
    ) : null
  ),
  ManualPaymentModal: ({ open }: { open: boolean }) => (
    open ? <div data-testid="manual-payment-dialog">Dialog</div> : null
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

  it("hides when schedule state is null and respects disabled/className", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <ManualPaymentButton scheduleState={null} onClick={onClick} />,
    );
    expect(screen.queryByRole("button", { name: /Ajustar pagamento/i })).toBeNull();

    rerender(
      <ManualPaymentButton
        scheduleState="FAILED_PERMANENT"
        onClick={onClick}
        disabled
        className="custom-class"
      />,
    );

    const button = screen.getByRole("button", { name: /Ajustar pagamento/i });
    expect(button).toBeDisabled();
    expect(button).toHaveClass("custom-class");
  });
});

describe("ManualPaymentRecovery", () => {
  it("opens modal when schedule and context are available", () => {
    const refetch = vi.fn();
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
      refetch,
    });

    render(
      <ManualPaymentRecovery
        contractedServiceId="service-1"
        serviceRequestId="request-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ajustar pagamento/i }));
    expect(screen.getByTestId("manual-payment-dialog")).toBeInTheDocument();
    expect(screen.queryByText("Pagamento falhou")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ajustar pagamento/i })).toHaveClass(
      "sm:w-auto",
    );

    fireEvent.click(screen.getByRole("button", { name: /complete-payment/i }));
    expect(refetch).toHaveBeenCalled();
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
    expect(screen.queryByTestId("manual-payment-dialog")).toBeNull();
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

  it("returns null when schedule is not eligible for manual recovery", () => {
    mockUsePaymentSchedule.mockReturnValue({
      isLoading: false,
      data: {
        schedule: {
          id: "sched-1",
          state: "PAID",
          contractedServiceId: "service-1",
          paymentTokenId: "token-1",
          installmentNumber: 1,
          baseAmount: 100,
          failureReason: null,
          failureCode: null,
          isDisputed: false,
          paidAt: "2026-07-01T00:00:00.000Z",
        },
        context: {
          acceptedProposalId: "proposal-1",
          serviceRequestId: "request-1",
        },
      },
      refetch: vi.fn(),
    });

    const { container } = render(
      <ManualPaymentRecovery
        contractedServiceId="service-1"
        serviceRequestId="request-1"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

