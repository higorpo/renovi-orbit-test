import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderPaymentHistoryList } from "../ProviderPaymentHistoryList";

const mockUseProviderPaymentHistory = vi.fn();

vi.mock("../../../hooks/useProviderPaymentHistory", () => ({
  useProviderPaymentHistory: () => mockUseProviderPaymentHistory(),
}));

vi.mock("../../ProviderSettlementDisclosure", () => ({
  ProviderSettlementDisclosure: ({ capturePaidAt }: { capturePaidAt: string }) => (
    <div data-testid="settlement">{capturePaidAt}</div>
  ),
}));

describe("ProviderPaymentHistoryList", () => {
  it("shows loading state", () => {
    mockUseProviderPaymentHistory.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<ProviderPaymentHistoryList />);
    expect(screen.getByText(/Carregando recebimentos/i)).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseProviderPaymentHistory.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<ProviderPaymentHistoryList />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Não foi possível carregar o histórico de recebimentos/i,
    );
  });

  it("shows empty state", () => {
    mockUseProviderPaymentHistory.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<ProviderPaymentHistoryList />);
    expect(screen.getByText(/Nenhum recebimento registrado ainda/i)).toBeInTheDocument();
  });

  it("renders receivables with original amount when net differs", () => {
    mockUseProviderPaymentHistory.mockReturnValue({
      data: [{
        scheduleId: "sched-1",
        contractedServiceId: "service-1",
        amountReceivedAtCapture: 1000,
        netAmountReceived: 850,
        receivedAt: "2026-07-01T12:00:00.000Z",
        refundedAmount: null,
        refundedAt: null,
        state: "PAID",
        isDisputed: true,
        createdAt: "2026-07-01T11:00:00.000Z",
      }],
      isLoading: false,
      isError: false,
    });

    render(<ProviderPaymentHistoryList />);

    expect(screen.getByText(/Valor original/i)).toBeInTheDocument();
    expect(screen.getByText("Chargeback em análise")).toBeInTheDocument();
    expect(screen.getByTestId("settlement")).toHaveTextContent("2026-07-01T12:00:00.000Z");
  });

  it("hides original amount and dispute badge when values match", () => {
    mockUseProviderPaymentHistory.mockReturnValue({
      data: [{
        scheduleId: "sched-2",
        contractedServiceId: "service-2",
        amountReceivedAtCapture: 900,
        netAmountReceived: 900,
        receivedAt: "2026-07-01T12:00:00.000Z",
        refundedAmount: null,
        refundedAt: null,
        state: "PAID",
        isDisputed: false,
        createdAt: "2026-07-01T11:00:00.000Z",
      }],
      isLoading: false,
      isError: false,
    });

    render(<ProviderPaymentHistoryList />);

    expect(screen.queryByText(/Valor original/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Chargeback em análise")).not.toBeInTheDocument();
  });
});
