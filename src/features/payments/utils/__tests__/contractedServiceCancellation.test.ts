import { describe, expect, it, vi } from "vitest";
import {
  approximateServiceExecutionAt,
  canCancelContractedService,
  estimateClientPenaltyTier,
  estimateClientRefundAmount,
  getCancellationDisclosure,
  isPreChargeScheduleState,
} from "../contractedServiceCancellation";

describe("isPreChargeScheduleState", () => {
  it("returns true for pre-charge states", () => {
    expect(isPreChargeScheduleState("SCHEDULED")).toBe(true);
    expect(isPreChargeScheduleState("FAILED")).toBe(true);
    expect(isPreChargeScheduleState("FAILED_PERMANENT")).toBe(true);
  });

  it("returns false for post-charge states", () => {
    expect(isPreChargeScheduleState("PAID")).toBe(false);
    expect(isPreChargeScheduleState("IN_ANALYSIS")).toBe(false);
  });
});

describe("canCancelContractedService", () => {
  it("blocks CANCELLED, COMPLETED, and IN_DISPUTE service statuses", () => {
    expect(
      canCancelContractedService({ serviceStatus: "CANCELLED", scheduleState: "PAID" }),
    ).toBe(false);
    expect(
      canCancelContractedService({ serviceStatus: "COMPLETED", scheduleState: "PAID" }),
    ).toBe(false);
    expect(
      canCancelContractedService({ serviceStatus: "IN_DISPUTE", scheduleState: "PAID" }),
    ).toBe(false);
  });

  it("allows EXECUTED when schedule is PAID (aligned with RPC)", () => {
    expect(
      canCancelContractedService({ serviceStatus: "EXECUTED", scheduleState: "PAID" }),
    ).toBe(true);
  });

  it("allows pre-charge cancellation without schedule", () => {
    expect(
      canCancelContractedService({ serviceStatus: "CONFIRMED", scheduleState: null }),
    ).toBe(true);
  });

  it("blocks IN_ANALYSIS and refund states", () => {
    expect(
      canCancelContractedService({ serviceStatus: "CONFIRMED", scheduleState: "IN_ANALYSIS" }),
    ).toBe(false);
    expect(
      canCancelContractedService({ serviceStatus: "CONFIRMED", scheduleState: "REFUNDED" }),
    ).toBe(false);
  });

  it("allows PAID schedule for active service", () => {
    expect(
      canCancelContractedService({ serviceStatus: "CONFIRMED", scheduleState: "PAID" }),
    ).toBe(true);
  });
});

describe("estimateClientRefundAmount", () => {
  const executionAt = new Date("2026-08-01T13:00:00");

  it("returns full charge amount when more than 48h before execution", () => {
    const now = new Date("2026-07-29T12:00:00");
    expect(estimateClientRefundAmount(600, 633.7, executionAt, now)).toEqual({
      refundAmount: 633.7,
      penaltyTier: "FULL_REFUND",
    });
  });

  it("applies 10% penalty between 12h and 48h on base amount only", () => {
    const now = new Date("2026-07-31T14:00:00");
    expect(estimateClientRefundAmount(600, 633.7, executionAt, now)).toEqual({
      refundAmount: 540,
      penaltyTier: "PENALTY_10",
    });
  });

  it("applies 30% penalty under 12h on base amount only", () => {
    const now = new Date("2026-08-01T08:00:00");
    expect(estimateClientRefundAmount(600, 633.7, executionAt, now)).toEqual({
      refundAmount: 420,
      penaltyTier: "PENALTY_30",
    });
  });
});

describe("approximateServiceExecutionAt", () => {
  it("maps afternoon shift to 13:00 America/Sao_Paulo", () => {
    const date = approximateServiceExecutionAt("2026-08-01", "afternoon");
    expect(date).not.toBeNull();
    // 13:00 America/Sao_Paulo in August is UTC-03 → 16:00Z
    expect(date?.toISOString()).toBe("2026-08-01T16:00:00.000Z");
  });

  it("maps morning/full_day shifts, defaults unknown shifts, and rejects invalid dates", () => {
    expect(approximateServiceExecutionAt("2026-08-01", "morning")?.toISOString()).toBe(
      "2026-08-01T11:00:00.000Z",
    );
    expect(approximateServiceExecutionAt("2026-08-01", "full_day")?.toISOString()).toBe(
      "2026-08-01T11:00:00.000Z",
    );
    expect(approximateServiceExecutionAt("2026-08-01", "unknown")?.toISOString()).toBe(
      "2026-08-01T11:00:00.000Z",
    );
    expect(approximateServiceExecutionAt("not-a-date", "morning")).toBeNull();
  });
});

describe("estimateClientPenaltyTier", () => {
  const executionAt = new Date("2026-08-01T13:00:00");

  it("returns FULL_REFUND, PENALTY_10 and PENALTY_30 by proximity", () => {
    expect(estimateClientPenaltyTier(executionAt, new Date("2026-07-29T12:00:00"))).toBe(
      "FULL_REFUND",
    );
    expect(estimateClientPenaltyTier(executionAt, new Date("2026-07-31T14:00:00"))).toBe(
      "PENALTY_10",
    );
    expect(estimateClientPenaltyTier(executionAt, new Date("2026-08-01T08:00:00"))).toBe(
      "PENALTY_30",
    );
  });
});

describe("getCancellationDisclosure", () => {
  it("describes pre-charge cancellation without fees", () => {
    const disclosure = getCancellationDisclosure({
      viewerRole: "client",
      scheduleState: "SCHEDULED",
      scheduledStartDate: "2026-08-01",
      scheduledShift: "afternoon",
    });

    expect(disclosure.description).toContain("A cobrança ainda não foi realizada");
  });

  it("describes provider full refund for paid services", () => {
    const disclosure = getCancellationDisclosure({
      viewerRole: "provider",
      scheduleState: "PAID",
      scheduledStartDate: "2026-08-01",
      scheduledShift: "afternoon",
    });

    expect(disclosure.description).toContain("estorno integral");
  });

  it("describes client penalty tiers without amounts when amounts are missing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T10:00:00"));

    const disclosure = getCancellationDisclosure({
      viewerRole: "client",
      scheduleState: "PAID",
      scheduledStartDate: "2026-08-01",
      scheduledShift: "afternoon",
    });

    expect(disclosure.description).toContain("70%");
    expect(disclosure.description).not.toMatch(/R\$/);

    vi.useRealTimers();
  });

  it("includes estimated refund amount when base and paid amounts are provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T12:00:00"));

    const disclosure = getCancellationDisclosure({
      viewerRole: "client",
      scheduleState: "PAID",
      scheduledStartDate: "2026-08-01",
      scheduledShift: "afternoon",
      baseAmount: 600,
      paidAmount: 633.7,
    });

    expect(disclosure.description).toContain("R$ 633,70");
    expect(disclosure.description).toContain("incluindo taxas de cartão");

    vi.setSystemTime(new Date("2026-07-31T14:00:00"));
    expect(
      getCancellationDisclosure({
        viewerRole: "client",
        scheduleState: "PAID",
        scheduledStartDate: "2026-08-01",
        scheduledShift: "afternoon",
        baseAmount: 600,
        paidAmount: 633.7,
      }).description,
    ).toContain("R$ 540,00");

    vi.useRealTimers();
  });

  it("describes FULL_REFUND and PENALTY_10 client disclosures without amounts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T12:00:00"));

    expect(
      getCancellationDisclosure({
        viewerRole: "client",
        scheduleState: "PAID",
        scheduledStartDate: "2026-08-01",
        scheduledShift: "afternoon",
      }).description,
    ).toContain("Reembolso integral do valor pago");

    vi.setSystemTime(new Date("2026-07-31T14:00:00"));
    expect(
      getCancellationDisclosure({
        viewerRole: "client",
        scheduleState: "PAID",
        scheduledStartDate: "2026-08-01",
        scheduledShift: "afternoon",
      }).description,
    ).toContain("90%");

    vi.useRealTimers();
  });

  it("falls back when scheduled date cannot be parsed", () => {
    const disclosure = getCancellationDisclosure({
      viewerRole: "client",
      scheduleState: "PAID",
      scheduledStartDate: "invalid",
      scheduledShift: "afternoon",
    });

    expect(disclosure.description).toContain("Termos de Uso");
  });

  it("prefers explicit serviceExecutionAt Date over schedule approximation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T12:00:00"));

    const disclosure = getCancellationDisclosure({
      viewerRole: "client",
      scheduleState: "PAID",
      scheduledStartDate: "invalid",
      scheduledShift: "afternoon",
      serviceExecutionAt: new Date("2026-08-10T16:00:00.000Z"),
      baseAmount: 600,
      paidAmount: 633.7,
    });

    expect(disclosure.description).toContain("R$ 633,70");
    vi.useRealTimers();
  });

  it("accepts serviceExecutionAt as ISO string and ignores invalid Date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T12:00:00"));

    expect(
      getCancellationDisclosure({
        viewerRole: "client",
        scheduleState: "PAID",
        scheduledStartDate: "2026-08-01",
        scheduledShift: "afternoon",
        serviceExecutionAt: "2026-08-10T16:00:00.000Z",
        baseAmount: 600,
        paidAmount: 633.7,
      }).description,
    ).toContain("R$ 633,70");

    expect(
      getCancellationDisclosure({
        viewerRole: "client",
        scheduleState: "PAID",
        scheduledStartDate: "invalid",
        scheduledShift: "afternoon",
        serviceExecutionAt: new Date("invalid"),
      }).description,
    ).toContain("Termos de Uso");

    vi.useRealTimers();
  });
});
