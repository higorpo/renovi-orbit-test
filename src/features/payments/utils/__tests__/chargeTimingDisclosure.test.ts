import { describe, expect, it } from "vitest";
import {
  computeChargeScheduledAt,
  formatChargeDate,
  getChargeTimingDisclosure,
} from "../chargeTimingDisclosure";

describe("computeChargeScheduledAt", () => {
  it("charges immediately when service is within 48 hours", () => {
    const now = new Date("2026-06-24T12:00:00.000Z");
    const serviceScheduledAt = new Date("2026-06-26T11:59:59.000Z");

    expect(computeChargeScheduledAt(serviceScheduledAt, now)).toEqual(now);
  });

  it("schedules charge two days before service when outside the emergency window", () => {
    const now = new Date("2026-06-24T12:00:00.000Z");
    const serviceScheduledAt = new Date("2026-06-30T12:00:00.000Z");

    expect(computeChargeScheduledAt(serviceScheduledAt, now).toISOString()).toBe(
      "2026-06-28T12:00:00.000Z",
    );
  });
});

describe("formatChargeDate", () => {
  it("formats charge dates in pt-BR", () => {
    const formatted = formatChargeDate(new Date("2026-06-28T15:30:00.000Z"));
    expect(formatted).toMatch(/2026/);
    expect(formatted.length).toBeGreaterThan(8);
  });
});

describe("getChargeTimingDisclosure", () => {
  it("shows emergency disclosure when service is within 48 hours", () => {
    const now = new Date("2026-06-24T12:00:00.000Z");
    const serviceScheduledAt = new Date("2026-06-25T12:00:00.000Z");

    const disclosure = getChargeTimingDisclosure(serviceScheduledAt, now);

    expect(disclosure.kind).toBe("emergency");
    expect(disclosure.message).toContain("próximas horas");
  });

  it("shows specific charge date for standard scheduling", () => {
    const now = new Date("2026-06-24T12:00:00.000Z");
    const serviceScheduledAt = new Date("2026-06-30T12:00:00.000Z");

    const disclosure = getChargeTimingDisclosure(serviceScheduledAt, now);

    expect(disclosure.kind).toBe("scheduled");
    if (disclosure.kind === "scheduled") {
      expect(disclosure.chargeScheduledAt.toISOString()).toBe("2026-06-28T12:00:00.000Z");
      expect(disclosure.message).toContain("2026");
    }
  });
});
