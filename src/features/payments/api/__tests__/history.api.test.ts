import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listClientPaymentTransactions,
  listProviderPaymentReceivables,
} from "../history.api";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

function createOrderChain<T>(result: { data: T; error: { message: string } | null }) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
  };
}

describe("listClientPaymentTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps client payment history rows", async () => {
    mockFrom.mockReturnValue(
      createOrderChain({
        data: [{
          schedule_id: "sched-1",
          contracted_service_id: "service-1",
          amount_paid: 1000,
          service_amount: 900,
          installment_number: 1,
          paid_at: "2026-07-01T12:00:00.000Z",
          refunded_amount: null,
          refunded_at: null,
          state: "PAID",
          is_disputed: false,
          created_at: "2026-07-01T11:00:00.000Z",
        }],
        error: null,
      }),
    );

    const result = await listClientPaymentTransactions();

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      scheduleId: "sched-1",
      contractedServiceId: "service-1",
      amountPaid: 1000,
      state: "PAID",
    });
    expect(mockFrom).toHaveBeenCalledWith("client_payment_transactions_v");
  });

  it("maps empty data arrays", async () => {
    mockFrom.mockReturnValue(
      createOrderChain({
        data: null,
        error: null,
      }),
    );

    await expect(listClientPaymentTransactions()).resolves.toEqual({
      data: [],
      error: null,
    });
  });

  it("returns empty list on fetch error", async () => {
    mockFrom.mockReturnValue(
      createOrderChain({
        data: null,
        error: { message: "client history failed" },
      }),
    );

    await expect(listClientPaymentTransactions()).resolves.toEqual({
      data: [],
      error: "client history failed",
    });
  });
});

describe("listProviderPaymentReceivables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps provider receivable rows", async () => {
    mockFrom.mockReturnValue(
      createOrderChain({
        data: [{
          schedule_id: "sched-2",
          contracted_service_id: "service-2",
          amount_received_at_capture: 900,
          net_amount_received: 810,
          received_at: "2026-07-02T12:00:00.000Z",
          refunded_amount: null,
          refunded_at: null,
          state: "PAID",
          is_disputed: false,
          created_at: "2026-07-02T11:00:00.000Z",
        }],
        error: null,
      }),
    );

    const result = await listProviderPaymentReceivables();

    expect(result.error).toBeNull();
    expect(result.data[0]).toMatchObject({
      scheduleId: "sched-2",
      netAmountReceived: 810,
      state: "PAID",
    });
    expect(mockFrom).toHaveBeenCalledWith("provider_payment_receivables_v");
  });

  it("returns empty list on fetch error", async () => {
    mockFrom.mockReturnValue(
      createOrderChain({
        data: null,
        error: { message: "provider history failed" },
      }),
    );

    await expect(listProviderPaymentReceivables()).resolves.toEqual({
      data: [],
      error: "provider history failed",
    });
  });

  it("maps empty provider data arrays", async () => {
    mockFrom.mockReturnValue(
      createOrderChain({
        data: null,
        error: null,
      }),
    );

    await expect(listProviderPaymentReceivables()).resolves.toEqual({
      data: [],
      error: null,
    });
  });
});
