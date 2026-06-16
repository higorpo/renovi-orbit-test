import { describe, expect, it } from "vitest";
import { MAX_PROPOSAL_REVISIONS } from "../../constants/proposalRevisions";
import { resolveClientProposalCtas } from "../clientProposalCtas";

describe("resolveClientProposalCtas", () => {
  it("returns client actions for pending proposals", () => {
    const ctas = resolveClientProposalCtas("PENDING");
    expect(ctas.map((cta) => cta.id)).toEqual(["accept", "reject", "request_revision"]);
  });

  it("returns no actions for non-pending proposals", () => {
    expect(resolveClientProposalCtas("submitted")).toEqual([]);
    expect(resolveClientProposalCtas("ACCEPTED")).toEqual([]);
  });

  it("disables revision when limit is reached", () => {
    const ctas = resolveClientProposalCtas("PENDING", MAX_PROPOSAL_REVISIONS);
    expect(ctas.find((cta) => cta.id === "request_revision")?.disabled).toBe(true);
  });
});
