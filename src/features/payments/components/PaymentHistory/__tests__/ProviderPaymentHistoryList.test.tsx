import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ProviderPaymentHistoryList } from "../ProviderPaymentHistoryList";

const mockUseProviderPaymentHistory = vi.fn();

vi.mock("../../../hooks/useProviderPaymentHistory", () => ({
  useProviderPaymentHistory: () => mockUseProviderPaymentHistory(),
}));

function renderList() {
  return render(
    <MemoryRouter>
      <ProviderPaymentHistoryList />
    </MemoryRouter>,
  );
}

describe("ProviderPaymentHistoryList", () => {
  it("shows loading state", () => {
    mockUseProviderPaymentHistory.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    renderList();
    expect(screen.getByLabelText(/Carregando cobranças/i)).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseProviderPaymentHistory.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    renderList();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Não foi possível carregar o histórico de cobranças/i,
    );
  });

  it("shows empty state", () => {
    mockUseProviderPaymentHistory.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    renderList();
    expect(screen.getByText(/Nenhuma cobrança ainda/i)).toBeInTheDocument();
  });

  it("renders agreed amount and net when they differ", () => {
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

    renderList();

    expect(screen.getByText(/Líquido após estornos/i)).toBeInTheDocument();
    expect(screen.getByText("Chargeback em análise")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ganhos/i })).not.toBeInTheDocument();
  });

  it("hides net breakdown and dispute badge when values match", () => {
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

    renderList();

    expect(screen.queryByText(/Líquido após estornos/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Chargeback em análise")).not.toBeInTheDocument();
  });
});
