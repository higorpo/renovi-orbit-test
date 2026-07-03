import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchContractedServicePaymentContext,
  fetchPaymentScheduleByContractedService,
  manualChargePayment,
} from "../charges.api";
import { PAYMENT_EDGE } from "../payments.edge";

const mockFrom = vi.fn();
const mockInvoke = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

function createSelectChain<T>(result: { data: T; error: { message: string } | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

describe("manualChargePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns charge outcome on successful edge invoke", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        schedule_id: "sched-1",
        outcome: "PAID",
        charge_amount: "1024.29",
      },
      error: null,
    });

    const result = await manualChargePayment({
      scheduleId: "sched-1",
      clearsaleSessionId: "session-1",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      scheduleId: "sched-1",
      outcome: "PAID",
      chargeAmount: "1024.29",
    });
    expect(mockInvoke).toHaveBeenCalledWith(PAYMENT_EDGE.manualChargePayment, {
      body: {
        schedule_id: "sched-1",
        clearsale_session_id: "session-1",
      },
    });
  });

  it("maps edge error payload on failure", async () => {
    mockInvoke.mockResolvedValue({
      data: { error_code: "RATE_LIMIT_EXCEEDED", error: "Muitas tentativas" },
      error: null,
    });

    const result = await manualChargePayment({
      scheduleId: "sched-1",
      clearsaleSessionId: "session-1",
    });

    expect(result.data).toBeNull();
    expect(result.errorCode).toBe("RATE_LIMIT_EXCEEDED");
    expect(result.error).toBe("RATE_LIMIT_EXCEEDED");
  });
});

describe("fetchPaymentScheduleByContractedService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps schedule row to summary", async () => {
    mockFrom.mockReturnValue(
      createSelectChain({
        data: {
          id: "sched-1",
          contracted_service_id: "service-1",
          state: "FAILED",
          client_card_token_id: "tok-1",
          installment_number: 1,
          base_amount: 1000,
          failure_reason: "Card declined",
          failure_code: "REJECTED",
          is_disputed: true,
          paid_at: "2026-07-01T12:00:00.000Z",
        },
        error: null,
      }),
    );

    const result = await fetchPaymentScheduleByContractedService("service-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      id: "sched-1",
      contractedServiceId: "service-1",
      state: "FAILED",
      paymentTokenId: "tok-1",
      installmentNumber: 1,
      baseAmount: 1000,
      failureReason: "Card declined",
      failureCode: "REJECTED",
      isDisputed: true,
      paidAt: "2026-07-01T12:00:00.000Z",
    });
  });
});

describe("fetchContractedServicePaymentContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns proposal and service request ids", async () => {
    mockFrom.mockReturnValue(
      createSelectChain({
        data: {
          accepted_proposal_id: "proposal-1",
          service_request_id: "sr-1",
        },
        error: null,
      }),
    );

    const result = await fetchContractedServicePaymentContext("service-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      acceptedProposalId: "proposal-1",
      serviceRequestId: "sr-1",
    });
  });
});
