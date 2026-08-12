import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettlementMovement } from "../../types/settlements.types";
import { EarningsPage } from "../EarningsPage";

const mocks = vi.hoisted(() => ({
  settlements: {
    items: [] as SettlementMovement[],
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    totalCount: 0,
  },
  useProviderSettlementsArgs: [] as Array<{ filterId?: string }>,
}));

vi.mock("../../hooks/useProviderSettlements", () => ({
  useProviderSettlements: (args: { filterId?: string } = {}) => {
    mocks.useProviderSettlementsArgs.push(args);
    return mocks.settlements;
  },
}));

const sampleItem: SettlementMovement = {
  id: "m-1",
  paymentScheduleId: "sched-1",
  providerId: "prov-1",
  gatewaySlug: "netcred",
  gatewayPayoutId: "payout-1",
  gatewayMovementId: "mov-1",
  gatewayTransactionId: "tx-1",
  payoutStatus: "PENDING",
  movementStatus: "PENDING",
  movementType: "CARD_PAYMENT",
  movementSource: "TRANSACTION",
  recordType: "CREDIT",
  installment: 1,
  grossAmount: 100,
  netAmount: 95,
  baseSettleDate: "2026-06-15",
  settlingAt: "2026-06-15",
  settledAt: null,
  isAdvance: false,
  isRefundClawback: false,
  brand: null,
  bankAccountMask: null,
  syncSource: "webhook",
  syncedAt: "2026-06-01T00:00:00.000Z",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  serviceRequestId: "sr-1",
  serviceRequestTitle: "Instalação de ar",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <EarningsPage />
    </MemoryRouter>,
  );
}

describe("EarningsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useProviderSettlementsArgs.length = 0;
    mocks.settlements.items = [];
    mocks.settlements.isLoading = false;
    mocks.settlements.isError = false;
    mocks.settlements.hasNextPage = false;
    mocks.settlements.isFetchingNextPage = false;
    mocks.settlements.totalCount = 0;
  });

  it("renders page chrome and link to receivables", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Ganhos" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Minha conta → Recebimentos/i }),
    ).toHaveAttribute("href", "/dashboard/account/receivables");
    expect(mocks.useProviderSettlementsArgs.at(-1)).toEqual({ filterId: "all" });
  });

  it("changes filter and passes it to the settlements hook", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Previsto" }));
    expect(mocks.useProviderSettlementsArgs.at(-1)).toEqual({ filterId: "pending" });
  });

  it("shows loading while fetching", () => {
    mocks.settlements.isLoading = true;
    renderPage();
    expect(screen.getByText(/Carregando ganhos/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Todos" })).toBeDisabled();
  });

  it("retries when list fails", () => {
    mocks.settlements.isError = true;
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(mocks.settlements.refetch).toHaveBeenCalled();
  });

  it("clears filters from empty filtered state", () => {
    mocks.settlements.items = [];
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Previsto" }));
    expect(screen.getByText("Nenhuma liquidação neste filtro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/i }));
    expect(mocks.useProviderSettlementsArgs.at(-1)).toEqual({ filterId: "all" });
    expect(screen.getByText("Nenhuma liquidação ainda")).toBeInTheDocument();
  });

  it("loads more when next page is available", () => {
    mocks.settlements.items = [sampleItem];
    mocks.settlements.hasNextPage = true;
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/i }));
    expect(mocks.settlements.fetchNextPage).toHaveBeenCalled();
  });
});
