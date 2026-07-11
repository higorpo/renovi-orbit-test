import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeProposalCountdown,
  formatProposalRemainingMs,
  PROPOSAL_COUNTDOWN_WARNING_MS,
  resolveProposalExpiresAt,
} from "../proposalCountdown";

describe("resolveProposalExpiresAt", () => {
  it("computes submitted_at plus SLA hours", () => {
    const expiresAt = resolveProposalExpiresAt({
      submittedAt: "2026-01-01T00:00:00.000Z",
      slaHours: 24,
    });

    expect(expiresAt?.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });

  it("returns null when submitted_at is missing", () => {
    expect(
      resolveProposalExpiresAt({
        submittedAt: null,
        slaHours: 24,
      }),
    ).toBeNull();
  });

  it("returns null when submitted_at is invalid", () => {
    expect(
      resolveProposalExpiresAt({
        submittedAt: "not-a-date",
        slaHours: 24,
      }),
    ).toBeNull();
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

  it("returns inactive for non-pending non-expired statuses", () => {
    const snapshot = computeProposalCountdown({
      status: "ACCEPTED",
      expiresAt: new Date("2026-01-01T23:00:00.000Z"),
    });
    expect(snapshot.phase).toBe("inactive");
    expect(snapshot.remainingLabel).toBe("");
  });

  it("returns inactive when pending but expiresAt is missing", () => {
    const snapshot = computeProposalCountdown({
      status: "PENDING",
      expiresAt: null,
    });
    expect(snapshot.phase).toBe("inactive");
    expect(snapshot.expiresAt).toBeNull();
  });

  it("marks pending proposals as expired when deadline has passed", () => {
    const snapshot = computeProposalCountdown({
      status: "PENDING",
      expiresAt: new Date("2026-01-01T10:00:00.000Z"),
    });
    expect(snapshot.phase).toBe("expired");
    expect(snapshot.remainingLabel).toBe("Prazo encerrado");
  });

  it("keeps active phase when more than 4 hours remain", () => {
    const expiresAt = new Date("2026-01-02T20:00:00.000Z");
    const snapshot = computeProposalCountdown({
      status: "PENDING",
      expiresAt,
    });
    expect(snapshot.phase).toBe("active");
    expect(snapshot.isWarning).toBe(false);
  });

  it("counts down for pending proposals", () => {
    const expiresAt = new Date("2026-01-01T23:00:00.000Z");
    const snapshot = computeProposalCountdown({
      status: "PENDING",
      expiresAt,
    });

    expect(snapshot.phase).toBe("warning");
    expect(snapshot.remainingLabel).toContain("3 h");
  });
});

describe("formatProposalRemainingMs", () => {
  it("formats sub-hour remaining time", () => {
    expect(formatProposalRemainingMs(45 * 60_000)).toBe("45 min");
  });

  it("formats closed deadline and multi-day remaining time", () => {
    expect(formatProposalRemainingMs(0)).toBe("Prazo encerrado");
    expect(formatProposalRemainingMs(26 * 60 * 60_000)).toBe("1 dia e 2 h");
    expect(formatProposalRemainingMs(48 * 60 * 60_000)).toBe("2 dias");
    expect(formatProposalRemainingMs(2 * 60 * 60_000)).toBe("2 h");
  });
});
