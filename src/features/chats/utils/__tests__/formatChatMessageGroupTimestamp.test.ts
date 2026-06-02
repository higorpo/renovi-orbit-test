import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatChatMessageGroupTimestamp } from "../formatChatMessageGroupTimestamp";

describe("formatChatMessageGroupTimestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-30T15:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats same-day timestamps as time only", () => {
    expect(formatChatMessageGroupTimestamp("2026-05-30T12:30:00.000Z")).toMatch(/\d{2}:\d{2}/);
    expect(formatChatMessageGroupTimestamp("2026-05-30T12:30:00.000Z")).not.toContain("Ontem");
  });

  it("formats yesterday timestamps with label and time", () => {
    expect(formatChatMessageGroupTimestamp("2026-05-29T12:30:00.000Z")).toMatch(
      /^Ontem \d{2}:\d{2}$/,
    );
  });

  it("formats older timestamps with short date and time", () => {
    expect(formatChatMessageGroupTimestamp("2026-05-28T12:30:00.000Z")).toMatch(
      /^\d{2}\/\d{2} \d{2}:\d{2}$/,
    );
  });
});
