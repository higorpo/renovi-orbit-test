import { describe, expect, it } from "vitest";
import { readRescheduleSlotFromWorkflowMessage } from "../readRescheduleSlotFromWorkflowMessage";

describe("readRescheduleSlotFromWorkflowMessage", () => {
  it("returns null when payload has no valid slot", () => {
    expect(readRescheduleSlotFromWorkflowMessage({ payload: {} })).toBeNull();
    expect(readRescheduleSlotFromWorkflowMessage({ payload: { slot: "x" } })).toBeNull();
    expect(
      readRescheduleSlotFromWorkflowMessage({
        payload: { slot: { start_date: "2030-06-10", shift: "evening" } },
      }),
    ).toBeNull();
  });

  it("reads a valid slot including optional end_date", () => {
    expect(
      readRescheduleSlotFromWorkflowMessage({
        payload: {
          slot: {
            start_date: "2030-06-10",
            end_date: "2030-06-12",
            shift: "afternoon",
          },
        },
      }),
    ).toEqual({
      start_date: "2030-06-10",
      end_date: "2030-06-12",
      shift: "afternoon",
    });
  });

  it("sets end_date to null when missing or not a string", () => {
    expect(
      readRescheduleSlotFromWorkflowMessage({
        payload: { slot: { start_date: "2030-06-10", shift: "morning", end_date: 1 } },
      }),
    ).toEqual({
      start_date: "2030-06-10",
      end_date: null,
      shift: "morning",
    });
  });
});
