import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatChatListTimestamp } from "../formatChatListTimestamp";

describe("formatChatListTimestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-30T15:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats same-day timestamps as time", () => {
    expect(formatChatListTimestamp("2026-05-30T12:30:00.000Z")).toMatch(/\d{2}:\d{2}/);
  });

  it("formats older timestamps as short date", () => {
    expect(formatChatListTimestamp("2026-05-28T12:30:00.000Z")).toMatch(/\d{2}\/\d{2}/);
  });
});
