import { describe, expect, it } from "vitest";
import { getChargeTimingDisclosure } from "../chargeTimingDisclosure";

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
