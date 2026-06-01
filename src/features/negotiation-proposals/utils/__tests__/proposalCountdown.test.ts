import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeProposalCountdown,
  formatProposalRemainingMs,
  PROPOSAL_COUNTDOWN_WARNING_MS,
  resolveProposalExpiresAt,
} from "../proposalCountdown";

describe("resolveProposalExpiresAt", () => {
  it("prefers server deadline over submitted_at + SLA", () => {
    const expiresAt = resolveProposalExpiresAt({
      submittedAt: "2026-01-01T00:00:00.000Z",
      clientResponseDeadlineAt: "2026-01-02T12:00:00.000Z",
      slaHours: 24,
    });

    expect(expiresAt?.toISOString()).toBe("2026-01-02T12:00:00.000Z");
  });

  it("falls back to submitted_at plus SLA hours", () => {
    const expiresAt = resolveProposalExpiresAt({
      submittedAt: "2026-01-01T00:00:00.000Z",
      slaHours: 24,
    });

    expect(expiresAt?.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
});

describe("computeProposalCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T20:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enters warning phase within 4 hours of expiry", () => {
    const expiresAt = new Date("2026-01-01T23:00:00.000Z");
    const snapshot = computeProposalCountdown({
      status: "PENDING",
      expiresAt,
    });

    expect(snapshot.isWarning).toBe(true);
    expect(snapshot.phase).toBe("warning");
    expect(snapshot.remainingMs).toBeLessThanOrEqual(PROPOSAL_COUNTDOWN_WARNING_MS);
  });

  it("marks expired proposals distinctly", () => {
    const snapshot = computeProposalCountdown({
      status: "EXPIRED",
      expiresAt: new Date("2026-01-01T10:00:00.000Z"),
    });

    expect(snapshot.phase).toBe("expired");
    expect(snapshot.isExpired).toBe(true);
  });
});

describe("formatProposalRemainingMs", () => {
  it("formats sub-hour remaining time", () => {
    expect(formatProposalRemainingMs(45 * 60_000)).toBe("45 min");
  });
});
