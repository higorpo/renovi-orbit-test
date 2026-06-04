import { describe, expect, it } from "vitest";
import { deriveRevisionRequestedProposalId } from "../deriveRevisionRequestedProposalId";

describe("deriveRevisionRequestedProposalId", () => {
  it("returns proposal id when status is REVISION_REQUESTED", () => {
    expect(deriveRevisionRequestedProposalId("p-1", "REVISION_REQUESTED")).toBe("p-1");
  });

  it("returns null for other statuses", () => {
    expect(deriveRevisionRequestedProposalId("p-1", "PENDING")).toBeNull();
    expect(deriveRevisionRequestedProposalId("p-1", "REVISED")).toBeNull();
  });

  it("returns null without proposal id", () => {
    expect(deriveRevisionRequestedProposalId(null, "REVISION_REQUESTED")).toBeNull();
  });
});
