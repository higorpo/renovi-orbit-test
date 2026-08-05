import { describe, expect, it } from "vitest";
import { deriveExecutedTemporalGate } from "../executedTemporal";

describe("deriveExecutedTemporalGate", () => {
  it("flags notYetDue before scheduled start (BRT)", () => {
    const now = new Date("2026-08-03T15:00:00.000Z"); // BRT 12:00 on Aug 3
    const gate = deriveExecutedTemporalGate({
      scheduledStartDate: "2026-08-10",
      scheduledEndDate: "2026-08-10",
      now,
    });
    expect(gate.notYetDue).toBe(true);
    expect(gate.willBeLate).toBe(false);
  });

  it("flags willBeLate after on-time ceiling (end + 1)", () => {
    const now = new Date("2026-08-15T15:00:00.000Z"); // BRT Aug 15
    const gate = deriveExecutedTemporalGate({
      scheduledStartDate: "2026-08-10",
      scheduledEndDate: "2026-08-10",
      now,
    });
    expect(gate.notYetDue).toBe(false);
    expect(gate.willBeLate).toBe(true);
    expect(gate.onTimeCeiling).toBe("2026-08-11");
  });

  it("is on-time on the ceiling day", () => {
    const now = new Date("2026-08-11T15:00:00.000Z"); // BRT Aug 11
    const gate = deriveExecutedTemporalGate({
      scheduledStartDate: "2026-08-10",
      now,
    });
    expect(gate.notYetDue).toBe(false);
    expect(gate.willBeLate).toBe(false);
  });
});
