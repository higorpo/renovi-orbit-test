import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeDate } from "@/lib/formatRelativeDate";

const NOW = new Date("2026-07-10T12:00:00.000Z");

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["2026-07-10T11:59:01.000Z", "Agora"],
    ["2026-07-10T11:55:00.000Z", "Há 5 min"],
    ["2026-07-10T10:00:00.000Z", "Há 2 h"],
    ["2026-07-09T12:00:00.000Z", "Há 1 dia"],
    ["2026-07-07T12:00:00.000Z", "Há 3 dias"],
    ["2026-07-03T12:00:00.000Z", "Há 1 semana"],
    ["2026-06-12T12:00:00.000Z", "Há 4 semanas"],
    ["2026-06-05T12:00:00.000Z", "05/06/2026"],
  ])("formats %s as %s", (date, expected) => {
    expect(formatRelativeDate(date)).toBe(expected);
  });

  it("treats future dates as current activity", () => {
    expect(formatRelativeDate("2026-07-10T12:05:00.000Z")).toBe("Agora");
  });
});
