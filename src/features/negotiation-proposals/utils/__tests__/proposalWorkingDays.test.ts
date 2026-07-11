import { describe, expect, it } from "vitest";
import {
  countInclusiveCalendarDaysISO,
  countInclusiveWorkingDaysISO,
  matchesProposalDayDurationISO,
} from "../proposalWorkingDays";

describe("proposal day duration", () => {
  it("counts calendar days inclusively", () => {
    expect(countInclusiveCalendarDaysISO("2026-06-05", "2026-06-07")).toBe(3);
  });

  it("counts working days excluding weekends", () => {
    expect(countInclusiveWorkingDaysISO("2026-06-05", "2026-06-09")).toBe(3);
    expect(countInclusiveWorkingDaysISO("2026-06-05", "2026-06-07")).toBe(1);
  });

  it("accepts Fri–Sun when duration is 3 calendar days", () => {
    expect(matchesProposalDayDurationISO("2026-06-05", "2026-06-07", 3)).toBe(true);
  });

  it("accepts Fri–Tue when duration is 3 working days", () => {
    expect(matchesProposalDayDurationISO("2026-06-05", "2026-06-09", 3)).toBe(true);
  });

  it("rejects when neither calendar nor working count matches", () => {
    expect(matchesProposalDayDurationISO("2026-06-05", "2026-06-08", 3)).toBe(false);
  });

  it("returns 0 for invalid or inverted date ranges", () => {
    expect(countInclusiveCalendarDaysISO("not-a-date", "2026-06-07")).toBe(0);
    expect(countInclusiveCalendarDaysISO("2026-06-07", "2026-06-05")).toBe(0);
    expect(countInclusiveWorkingDaysISO("bad", "2026-06-09")).toBe(0);
    expect(countInclusiveWorkingDaysISO("2026-06-09", "2026-06-05")).toBe(0);
  });
});
