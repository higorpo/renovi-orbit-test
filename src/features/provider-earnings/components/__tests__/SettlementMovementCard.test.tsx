import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { SettlementMovement } from "../../types/settlements.types";
import { SettlementMovementCard } from "../SettlementMovementCard";

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
    bankAccountMask: "****1234",
    syncSource: "webhook",
    syncedAt: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    serviceRequestId: "sr-1",
    serviceRequestTitle: "Instalação de ar condicionado",
    ...overrides,
  };
}

function renderCard(item: SettlementMovement, props?: { showServiceLink?: boolean }) {
  return render(
    <MemoryRouter initialEntries={["/dashboard/earnings"]}>
      <SettlementMovementCard item={item} showServiceLink={props?.showServiceLink} />
    </MemoryRouter>,
  );
}

describe("SettlementMovementCard", () => {
  it("renders credit settlement with forecast, installment, bank mask and service link", () => {
    renderCard(makeItem());

    expect(screen.getByRole("article", { name: /Liquidação/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Instalação de ar condicionado" }),
    ).toHaveAttribute("href", "/dashboard/services/sr-1");
    expect(screen.getByText("Previsto")).toBeInTheDocument();
    expect(screen.getByText(/Previsão:/i)).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.getByText("Parcela 1")).toBeInTheDocument();
    expect(screen.getByText("Conta: ****1234")).toBeInTheDocument();
    expect(screen.queryByText("Estorno")).not.toBeInTheDocument();
  });

  it("hides service link when showServiceLink is false", () => {
    renderCard(makeItem(), { showServiceLink: false });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders debit clawback with destructive styling and settled label", () => {
    renderCard(
      makeItem({
        recordType: "DEBIT",
        isRefundClawback: true,
        movementStatus: "PAID_OUT",
        settledAt: "2026-06-20",
        settlingAt: null,
        installment: null,
        bankAccountMask: null,
        netAmount: 40,
        serviceRequestId: null,
        serviceRequestTitle: null,
      }),
    );

    expect(screen.getByText("Estorno")).toBeInTheDocument();
    expect(screen.getByText("Liquidado")).toBeInTheDocument();
    expect(screen.getByText(/Liquidado em/i)).toBeInTheDocument();
    expect(screen.queryByText(/Previsão:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Conta:/i)).not.toBeInTheDocument();
  });

  it("shows paid-out badge without settled date as Liquidado", () => {
    renderCard(
      makeItem({
        movementStatus: "PAID_OUT",
        settledAt: null,
        settlingAt: "2026-07-01",
      }),
    );

    expect(screen.getAllByText("Liquidado").length).toBeGreaterThanOrEqual(1);
  });
});
