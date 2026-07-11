import { describe, expect, it } from "vitest";
import type { ProposalStatus } from "../../types/proposals.types";
import {
  PROPOSAL_STATUSES,
  assertProposalStatusExhaustive,
  coerceProposalStatus,
  defineProposalStatusMap,
  isProposalStatus,
} from "../proposalStatus";

describe("proposalStatus constants", () => {
  it("lists every ProposalStatus enum value", () => {
    const expected: ProposalStatus[] = [
      "PENDING",
      "ACCEPTED",
      "REJECTED",
      "EXPIRED",
      "REVISION_REQUESTED",
      "REVISED",
      "REJECTED_AUTOMATICALLY",
    ];
    expect([...PROPOSAL_STATUSES].sort()).toEqual([...expected].sort());
  });

  it("defineProposalStatusMap requires all statuses", () => {
    const labels = defineProposalStatusMap({
      PENDING: "a",
      ACCEPTED: "b",
      REJECTED: "c",
      EXPIRED: "d",
      REVISION_REQUESTED: "e",
      REVISED: "f",
      REJECTED_AUTOMATICALLY: "g",
    });
    expect(labels.PENDING).toBe("a");
  });

  it("returns null for unknown status", () => {
    expect(coerceProposalStatus("CANCELLED")).toBeNull();
    expect(coerceProposalStatus("submitted")).toBeNull();
    expect(coerceProposalStatus(null)).toBeNull();
    expect(coerceProposalStatus(undefined)).toBeNull();
    expect(coerceProposalStatus("  pending  ")).toBe("PENDING");
    expect(isProposalStatus("PENDING")).toBe(true);
    expect(isProposalStatus("UNKNOWN")).toBe(false);
  });

  it("throws for unhandled exhaustive status", () => {
    expect(() => assertProposalStatusExhaustive("UNEXPECTED" as never)).toThrow(
      /Unhandled proposal status/,
    );
  });
});
