import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientPaymentHistoryList } from "../ClientPaymentHistoryList";

const mockUseClientPaymentHistory = vi.fn();

vi.mock("../../../hooks/useClientPaymentHistory", () => ({
  useClientPaymentHistory: () => mockUseClientPaymentHistory(),
}));

describe("ClientPaymentHistoryList", () => {
  it("shows loading state", () => {
    mockUseClientPaymentHistory.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<ClientPaymentHistoryList />);
    expect(screen.getByText(/Carregando histórico/i)).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseClientPaymentHistory.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<ClientPaymentHistoryList />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Não foi possível carregar o histórico/i,
    );
  });

  it("shows empty state", () => {
    mockUseClientPaymentHistory.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<ClientPaymentHistoryList />);
    expect(screen.getByText(/Nenhum pagamento registrado ainda/i)).toBeInTheDocument();
  });

  it("renders transactions with installment and dispute badge", () => {
    mockUseClientPaymentHistory.mockReturnValue({
      data: [{
        scheduleId: "sched-1",
        contractedServiceId: "service-1",
        amountPaid: 1000,
        serviceAmount: 900,
        installmentNumber: 3,
        paidAt: "2026-07-01T12:00:00.000Z",
        refundedAmount: null,
        refundedAt: null,
        state: "PAID",
        isDisputed: true,
        createdAt: "2026-07-01T11:00:00.000Z",
      }],
      isLoading: false,
      isError: false,
    });

    render(<ClientPaymentHistoryList />);

    expect(screen.getByText(/3x/)).toBeInTheDocument();
    expect(screen.getByText("Chargeback em análise")).toBeInTheDocument();
  });

  it("hides installment suffix and dispute badge for single-payment rows", () => {
    mockUseClientPaymentHistory.mockReturnValue({
      data: [{
        scheduleId: "sched-2",
        contractedServiceId: "service-2",
        amountPaid: 500,
        serviceAmount: 500,
        installmentNumber: 1,
        paidAt: "2026-07-01T12:00:00.000Z",
        refundedAmount: null,
        refundedAt: null,
        state: "PAID",
        isDisputed: false,
        createdAt: "2026-07-01T11:00:00.000Z",
      }],
      isLoading: false,
      isError: false,
    });

    render(<ClientPaymentHistoryList />);

    expect(screen.queryByText(/3x|2x/)).not.toBeInTheDocument();
    expect(screen.queryByText("Chargeback em análise")).not.toBeInTheDocument();
  });

  it("shows struck original amount, net charged, and refunded amount for partial refund", () => {
    mockUseClientPaymentHistory.mockReturnValue({
      data: [{
        scheduleId: "sched-3",
        contractedServiceId: "service-3",
        amountPaid: 633.7,
        serviceAmount: 600,
        installmentNumber: 1,
        paidAt: "2026-07-01T12:00:00.000Z",
        refundedAmount: 540,
        refundedAt: "2026-07-02T12:00:00.000Z",
        state: "PARTIALLY_REFUNDED",
        isDisputed: false,
        createdAt: "2026-07-01T11:00:00.000Z",
      }],
      isLoading: false,
      isError: false,
    });

    render(<ClientPaymentHistoryList />);

    expect(screen.getByText("R$ 633,70")).toHaveClass("line-through");
    expect(screen.getByText("R$ 93,70")).toBeInTheDocument();
    expect(screen.getByText(/Reembolsado:\s*R\$ 540,00/)).toBeInTheDocument();
    expect(screen.getByText(/Reembolso parcial/)).toBeInTheDocument();
  });

  it("shows pending refund wording while refund is still requested", () => {
    mockUseClientPaymentHistory.mockReturnValue({
      data: [{
        scheduleId: "sched-4",
        contractedServiceId: "service-4",
        amountPaid: 633.7,
        serviceAmount: 600,
        installmentNumber: 1,
        paidAt: "2026-07-01T12:00:00.000Z",
        refundedAmount: 633.7,
        refundedAt: null,
        state: "REFUND_REQUESTED",
        isDisputed: false,
        createdAt: "2026-07-01T11:00:00.000Z",
      }],
      isLoading: false,
      isError: false,
    });

    render(<ClientPaymentHistoryList />);

    const struckOriginal = screen.getByText("R$ 633,70");
    expect(struckOriginal).toHaveClass("line-through");
    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
    expect(screen.getByText(/Reembolso em processamento:\s*R\$ 633,70/)).toBeInTheDocument();
    expect(screen.queryByText(/Reembolsado:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Reembolso solicitado \/ em processamento/)).toBeInTheDocument();
  });
});
