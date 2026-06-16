import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getScheduleHighlightContent } from "../formatScheduledSummary";
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
