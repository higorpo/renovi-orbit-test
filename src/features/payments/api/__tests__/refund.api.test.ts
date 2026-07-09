import { beforeEach, describe, expect, it, vi } from "vitest";
import { processContractedServiceRefund } from "../refund.api";
import { PAYMENT_EDGE } from "../payments.edge";
import { logger } from "@/lib/logger";

const mockInvokePaymentEdgeFunction = vi.fn();
const mockMapEdgeErrorPayload = vi.fn();

vi.mock("../paymentApiClient", () => ({
  invokePaymentEdgeFunction: (...args: unknown[]) => mockInvokePaymentEdgeFunction(...args),
  mapEdgeErrorPayload: (...args: unknown[]) => mockMapEdgeErrorPayload(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

describe("processContractedServiceRefund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns PRE_CHARGE_CANCELLED outcome", async () => {
    mockInvokePaymentEdgeFunction.mockResolvedValue({
      ok: true,
      status: 200,
      payload: {
        outcome: "PRE_CHARGE_CANCELLED",
        schedule_id: "sched-1",
      },
    });

    const result = await processContractedServiceRefund({
      contractedServiceId: "service-1",
    });

    expect(result).toEqual({
      data: {
        scheduleId: "sched-1",
        outcome: "PRE_CHARGE_CANCELLED",
      },
      error: null,
    });
    expect(mockInvokePaymentEdgeFunction).toHaveBeenCalledWith(
      PAYMENT_EDGE.processRefund,
      {
        service_id: "service-1",
        cancellation_reason: "CLIENT_INITIATED",
      },
    );
  });

  it("returns REFUND_SUBMITTED with optional fields", async () => {
    mockInvokePaymentEdgeFunction.mockResolvedValue({
      ok: true,
      status: 200,
      payload: {
        outcome: "REFUND_SUBMITTED",
        schedule_id: "sched-2",
        refund_amount: 150.5,
        penalty_tier: "TIER_1",
        expected_days: 7,
      },
    });

    const result = await processContractedServiceRefund({
      contractedServiceId: "service-2",
      cancellationReason: "PROVIDER_INITIATED",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      scheduleId: "sched-2",
      outcome: "REFUND_SUBMITTED",
      refundAmount: "150.5",
      penaltyTier: "TIER_1",
      expectedDays: "7",
    });
  });

  it("omits optional refund fields when payload values are null", async () => {
    mockInvokePaymentEdgeFunction.mockResolvedValue({
      ok: true,
      status: 200,
      payload: {
        outcome: "REFUND_SUBMITTED",
        schedule_id: "sched-3",
        refund_amount: null,
        penalty_tier: null,
        expected_days: null,
      },
    });

    const result = await processContractedServiceRefund({
      contractedServiceId: "service-3",
    });

    expect(result.data).toEqual({
      scheduleId: "sched-3",
      outcome: "REFUND_SUBMITTED",
      refundAmount: undefined,
      penaltyTier: null,
      expectedDays: undefined,
    });
  });

  it("maps edge failure through cancellation error messages", async () => {
    mockInvokePaymentEdgeFunction.mockResolvedValue({
      ok: false,
      status: 409,
      payload: { error_code: "SERVICE_NOT_CANCELLABLE" },
    });
    mockMapEdgeErrorPayload.mockReturnValue({
      message: "SERVICE_NOT_CANCELLABLE",
      errorCode: "SERVICE_NOT_CANCELLABLE",
    });

    const result = await processContractedServiceRefund({
      contractedServiceId: "service-3",
    });

    expect(result.data).toBeNull();
    expect(result.error).toContain("não pode mais ser cancelado");
    expect(result.errorCode).toBe("SERVICE_NOT_CANCELLABLE");
    expect(result.status).toBe(409);
    expect(logger.warn).toHaveBeenCalledWith(
      "process_refund_failed",
      expect.objectContaining({ contractedServiceId: "service-3" }),
    );
  });

  it("uses message as code when errorCode is missing", async () => {
    mockInvokePaymentEdgeFunction.mockResolvedValue({
      ok: false,
      status: 500,
      payload: {},
    });
    mockMapEdgeErrorPayload.mockReturnValue({
      message: "Falha ao cancelar serviço",
      errorCode: undefined,
    });

    const result = await processContractedServiceRefund({
      contractedServiceId: "service-4",
    });

    expect(result.errorCode).toBe("Falha ao cancelar serviço");
    expect(result.error).toBe("Não foi possível cancelar o serviço. Tente novamente.");
  });
});
