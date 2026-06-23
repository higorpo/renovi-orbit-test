import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getScheduleHighlightContent,
  getScheduledTiming,
} from "../formatScheduledSummary";
import type { ContractedServiceSummary } from "../../types/service.types";

function contracted(
  overrides: Partial<ContractedServiceSummary> = {},
): ContractedServiceSummary {
  return {
    id: "cs-1",
    status: "CONFIRMED",
    agreedSlot: null,
    durationUnit: "hours",
    durationValue: 4,
    scheduledStartDate: "2025-06-09",
    scheduledEndDate: null,
    scheduledShift: "morning",
    provider: null,
    chatId: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("getScheduleHighlightContent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-08T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses turno wording for today instead of às horário", () => {
    const result = getScheduleHighlightContent(
      contracted({ scheduledStartDate: "2025-06-08", scheduledShift: "afternoon" }),
    );
    expect(result?.title).toBe("Serviço hoje · turno da tarde");
  });

  it("uses turno wording for tomorrow", () => {
    const result = getScheduleHighlightContent(
      contracted({ scheduledStartDate: "2025-06-09", scheduledShift: "morning" }),
    );
    expect(result?.title).toBe("Agendado para amanhã · turno da manhã");
  });

  it("uses plain label for full_day shift", () => {
    const result = getScheduleHighlightContent(
      contracted({ scheduledStartDate: "2025-06-08", scheduledShift: "full_day" }),
    );
    expect(result?.title).toBe("Serviço hoje · dia inteiro");
  });
});

describe("getScheduledTiming", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-08T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today when today falls inside a multi-day range", () => {
    expect(getScheduledTiming("2025-06-07", "2025-06-08")).toBe("today");
    expect(getScheduledTiming("2025-06-07", "2025-06-09")).toBe("today");
    expect(getScheduledTiming("2025-06-08", "2025-06-09")).toBe("today");
  });

  it("returns tomorrow when tomorrow is in range but today is not", () => {
    expect(getScheduledTiming("2025-06-09", "2025-06-09")).toBe("tomorrow");
    expect(getScheduledTiming("2025-06-09", "2025-06-12")).toBe("tomorrow");
  });

  it("returns past when the full range ended before today", () => {
    expect(getScheduledTiming("2025-06-06", "2025-06-07")).toBe("past");
    expect(getScheduledTiming("2025-06-07", null)).toBe("past");
  });

  it("returns future when the range starts after tomorrow", () => {
    expect(getScheduledTiming("2025-06-10", "2025-06-12")).toBe("future");
    expect(getScheduledTiming("2025-06-10", null)).toBe("future");
  });

  it("treats a missing end date as a single-day schedule", () => {
    expect(getScheduledTiming("2025-06-08", null)).toBe("today");
    expect(getScheduledTiming("2025-06-09", null)).toBe("tomorrow");
  });

  it("returns tomorrow for the next civil calendar day", () => {
    vi.setSystemTime(new Date(2026, 5, 23, 12, 0, 0));

    expect(getScheduledTiming("2026-06-24", null)).toBe("tomorrow");
    expect(
      getScheduleHighlightContent(
        contracted({
          scheduledStartDate: "2026-06-24",
          scheduledEndDate: null,
          scheduledShift: "afternoon",
        }),
      )?.title,
    ).toBe("Agendado para amanhã · turno da tarde");
  });
});
