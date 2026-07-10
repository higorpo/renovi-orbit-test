import { describe, expect, it } from "vitest";
import {
  getRescheduleCardSurfaceClass,
  getRescheduleStatusIcon,
} from "../rescheduleVisualState";
import type { ServiceRescheduleRequestStatus } from "../../types/serviceReschedule.types";

const ALL_STATUSES: ServiceRescheduleRequestStatus[] = [
  "REQUESTED",
  "PROPOSED",
  "ADJUSTMENT_REQUESTED",
  "ACCEPTED",
  "CANCELLED",
  "EXPIRED",
  "SUPERSEDED",
];

describe("rescheduleVisualState", () => {
  it("returns a surface class for every known status", () => {
    for (const status of ALL_STATUSES) {
      expect(getRescheduleCardSurfaceClass(status)).toMatch(/border-/);
    }
  });

  it("maps statuses to distinct icon components", () => {
    const accepted = getRescheduleStatusIcon("ACCEPTED");
    const cancelled = getRescheduleStatusIcon("CANCELLED");
    const expired = getRescheduleStatusIcon("EXPIRED");
    const proposed = getRescheduleStatusIcon("PROPOSED");
    const requested = getRescheduleStatusIcon("REQUESTED");
    const adjustment = getRescheduleStatusIcon("ADJUSTMENT_REQUESTED");

    expect(accepted).not.toBe(cancelled);
    expect(cancelled).toBe(expired);
    expect(proposed).not.toBe(requested);
    expect(adjustment).not.toBe(proposed);
    expect(typeof accepted).toBe("object");
  });
});
