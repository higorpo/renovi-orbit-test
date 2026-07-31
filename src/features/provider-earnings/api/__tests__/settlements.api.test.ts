import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProviderSettlements } from "../settlements.api";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const logger = await import("@/lib/logger").then((m) => m.logger);

describe("listProviderSettlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps RPC snake_case rows to camelCase domain model", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        items: [
          {
            id: "m-1",
            payment_schedule_id: "sched-1",
            provider_id: "prov-1",
            gateway_slug: "netcred",
            gateway_payout_id: "payout-1",
            gateway_movement_id: "mov-1",
            gateway_transaction_id: "tx-1",
            payout_status: "PENDING",
            movement_status: "PENDING",
            movement_type: "CARD_PAYMENT",
            movement_source: "TRANSACTION",
            record_type: "CREDIT",
            installment: 1,
            gross_amount: "100.00",
            net_amount: "95.50",
            base_settle_date: "2026-06-15",
            settling_at: "2026-06-15",
            settled_at: null,
            is_advance: false,
            is_refund_clawback: false,
            brand: "MCC",
            bank_account_mask: "****123",
            sync_source: "webhook",
            synced_at: "2026-06-01T00:00:00.000Z",
            created_at: "2026-06-01T00:00:00.000Z",
            updated_at: "2026-06-01T00:00:00.000Z",
          },
        ],
        total_count: 1,
        page: 1,
        page_size: 20,
      },
      error: null,
    });

    const result = await listProviderSettlements({
      page: 1,
      pageSize: 20,
      movementStatus: "PENDING",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("list_provider_settlement_movements", {
      p_page: 1,
      p_page_size: 20,
      p_movement_status: "PENDING",
      p_record_type: undefined,
      p_settling_from: undefined,
      p_settling_to: undefined,
      p_settled_from: undefined,
      p_settled_to: undefined,
    });
    expect(result.error).toBeNull();
    expect(result.data?.items[0]).toMatchObject({
      id: "m-1",
      paymentScheduleId: "sched-1",
      netAmount: 95.5,
      recordType: "CREDIT",
      settlingAt: "2026-06-15",
    });
  });

  it("returns error when RPC fails", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "rpc failed" },
    });

    const result = await listProviderSettlements({ page: 1, pageSize: 20 });

    expect(result.data).toBeNull();
    expect(result.error).toBe("rpc failed");
    expect(logger.error).toHaveBeenCalled();
  });

  it("returns error for invalid payload shape", async () => {
    mocks.rpc.mockResolvedValue({
      data: "not-an-object",
      error: null,
    });

    const result = await listProviderSettlements({ page: 1, pageSize: 20 });
    expect(result.data).toBeNull();
    expect(result.error).toBe("Resposta inválida do servidor");
  });

  it("rejects array payloads as invalid", async () => {
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await listProviderSettlements({ page: 1, pageSize: 20 });
    expect(result.data).toBeNull();
    expect(result.error).toBe("Resposta inválida do servidor");
  });

  it("clamps page and pageSize before calling RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: { items: [], total_count: 0, page: 1, page_size: 100 },
      error: null,
    });

    await listProviderSettlements({ page: 0, pageSize: 500 });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "list_provider_settlement_movements",
      expect.objectContaining({ p_page: 1, p_page_size: 100 }),
    );
  });

  it("coerces amount strings/numbers and maps DEBIT record type", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        items: [
          {
            id: "m-debit",
            payment_schedule_id: null,
            provider_id: "prov-1",
            gateway_slug: "netcred",
            gateway_payout_id: "payout-1",
            gateway_movement_id: "mov-2",
            gateway_transaction_id: "tx-2",
            payout_status: null,
            movement_status: "PAID_OUT",
            movement_type: null,
            movement_source: null,
            record_type: "DEBIT",
            installment: null,
            gross_amount: Number.NaN,
            net_amount: "not-a-number",
            base_settle_date: null,
            settling_at: null,
            settled_at: "2026-06-20",
            is_advance: false,
            is_refund_clawback: true,
            brand: null,
            bank_account_mask: null,
            sync_source: "webhook",
            synced_at: "2026-06-01T00:00:00.000Z",
            created_at: "2026-06-01T00:00:00.000Z",
            updated_at: "2026-06-01T00:00:00.000Z",
          },
          {
            id: "m-credit",
            payment_schedule_id: "sched-1",
            provider_id: "prov-1",
            gateway_slug: "netcred",
            gateway_payout_id: "payout-1",
            gateway_movement_id: "mov-3",
            gateway_transaction_id: "tx-3",
            payout_status: "PENDING",
            movement_status: "PENDING",
            movement_type: "CARD_PAYMENT",
            movement_source: "TRANSACTION",
            record_type: "CREDIT",
            installment: 2,
            gross_amount: 200,
            net_amount: 190,
            base_settle_date: "2026-07-01",
            settling_at: "2026-07-01",
            settled_at: null,
            is_advance: false,
            is_refund_clawback: false,
            brand: null,
            bank_account_mask: "****999",
            sync_source: "sync",
            synced_at: "2026-06-02T00:00:00.000Z",
            created_at: "2026-06-02T00:00:00.000Z",
            updated_at: "2026-06-02T00:00:00.000Z",
          },
        ],
        total_count: 2,
        page: 1,
        page_size: 20,
      },
      error: null,
    });

    const result = await listProviderSettlements({ page: 1, pageSize: 20 });

    expect(result.error).toBeNull();
    expect(result.data?.items[0]).toMatchObject({
      recordType: "DEBIT",
      grossAmount: 0,
      netAmount: 0,
    });
    expect(result.data?.items[1]).toMatchObject({
      recordType: "CREDIT",
      grossAmount: 200,
      netAmount: 190,
    });
  });

  it("defaults missing pagination fields and empty items from object payload", async () => {
    mocks.rpc.mockResolvedValue({
      data: {},
      error: null,
    });

    const result = await listProviderSettlements({ page: 3, pageSize: 15 });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      items: [],
      total_count: 0,
      page: 3,
      page_size: 15,
    });
  });
});
