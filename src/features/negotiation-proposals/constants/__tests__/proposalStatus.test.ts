import { describe, expect, it } from "vitest";
import type { ProposalStatus } from "../../types/proposals.types";
import {
  PROPOSAL_STATUSES,
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
    expect(isProposalStatus("PENDING")).toBe(true);
    expect(isProposalStatus("UNKNOWN")).toBe(false);
  });
});
