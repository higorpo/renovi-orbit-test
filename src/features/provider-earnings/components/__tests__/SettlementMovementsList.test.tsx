import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SettlementMovement } from "../../types/settlements.types";
import { SettlementMovementsList } from "../SettlementMovementsList";

function makeItem(overrides: Partial<SettlementMovement> = {}): SettlementMovement {
  return {
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
    ...overrides,
  };
}

const baseProps = {
  isLoading: false,
  isError: false,
  hasFilters: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  onLoadMore: vi.fn(),
  onRetry: vi.fn(),
  onClearFilters: vi.fn(),
};

describe("SettlementMovementsList", () => {
  it("shows loading state", () => {
    render(<SettlementMovementsList {...baseProps} items={[]} isLoading />);
    expect(screen.getByText(/Carregando ganhos/i)).toBeInTheDocument();
  });

  it("shows error state with retry", () => {
    const onRetry = vi.fn();
    render(<SettlementMovementsList {...baseProps} items={[]} isError onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows empty state and clear filters when filtered", () => {
    const onClearFilters = vi.fn();
    render(
      <SettlementMovementsList
        {...baseProps}
        items={[]}
        hasFilters
        onClearFilters={onClearFilters}
      />,
    );

    expect(screen.getByText("Nenhuma liquidação neste filtro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/i }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("renders single cards and grouped installments", () => {
    render(
      <SettlementMovementsList
        {...baseProps}
        items={[
          makeItem({ id: "m-1", installment: 1 }),
          makeItem({ id: "m-2", installment: 2, paymentScheduleId: "sched-1" }),
          makeItem({
            id: "m-orphan",
            paymentScheduleId: null,
            installment: null,
            netAmount: 50,
          }),
        ]}
      />,
    );

    expect(screen.getByRole("list", { name: /Lista de liquidações/i })).toBeInTheDocument();
    expect(screen.getByText("Parcelas do mesmo pagamento")).toBeInTheDocument();
    expect(screen.getAllByRole("article").length).toBe(3);
  });

  it("renders load more when there is a next page", () => {
    const onLoadMore = vi.fn();
    render(
      <SettlementMovementsList
        {...baseProps}
        items={[makeItem()]}
        hasNextPage
        onLoadMore={onLoadMore}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/i }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
