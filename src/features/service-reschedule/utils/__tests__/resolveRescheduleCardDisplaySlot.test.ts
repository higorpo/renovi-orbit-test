import { describe, expect, it } from "vitest";
import { resolveRescheduleCardDisplaySlot } from "../resolveRescheduleCardDisplaySlot";

const originalSlot = {
  start_date: "2026-06-10",
  end_date: "2026-06-10",
  shift: "morning" as const,
};

const firstProposedSlot = {
  start_date: "2026-06-17",
  end_date: "2026-06-17",
  shift: "afternoon" as const,
};

const secondProposedSlot = {
  start_date: "2026-06-24",
  end_date: "2026-06-24",
  shift: "morning" as const,
};

describe("resolveRescheduleCardDisplaySlot", () => {
  it("prefers workflow message slot for superseded cards", () => {
    expect(
      resolveRescheduleCardDisplaySlot(
        "SUPERSEDED",
        firstProposedSlot,
        originalSlot,
        secondProposedSlot,
      ),
    ).toEqual(firstProposedSlot);
  });

  it("prefers workflow message slot for active proposed cards", () => {
    expect(
      resolveRescheduleCardDisplaySlot(
        "PROPOSED",
        secondProposedSlot,
        originalSlot,
        firstProposedSlot,
      ),
    ).toEqual(secondProposedSlot);
  });

  it("falls back to hydrated proposed slot when message slot is missing", () => {
    expect(
      resolveRescheduleCardDisplaySlot("SUPERSEDED", null, originalSlot, firstProposedSlot),
    ).toEqual(firstProposedSlot);
  });

  it("shows original slot while waiting for a new proposal", () => {
    expect(
      resolveRescheduleCardDisplaySlot(
        "ADJUSTMENT_REQUESTED",
        firstProposedSlot,
        originalSlot,
        firstProposedSlot,
      ),
    ).toEqual(originalSlot);
  });

  it("falls back to proposed then message slot for ended statuses", () => {
    expect(
      resolveRescheduleCardDisplaySlot("CANCELLED", firstProposedSlot, originalSlot, null),
    ).toEqual(firstProposedSlot);

    expect(
      resolveRescheduleCardDisplaySlot("EXPIRED", null, originalSlot, secondProposedSlot),
    ).toEqual(secondProposedSlot);
  });
});
