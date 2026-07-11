import { describe, expect, it } from "vitest";
import { PROPOSAL_COPY_VARIANTS } from "../proposalCopyVariants";

describe("PROPOSAL_COPY_VARIANTS", () => {
  it("keeps distinct proposal vs budget wording", () => {
    expect(PROPOSAL_COPY_VARIANTS.proposal.detailsTitle).toMatch(/proposta/i);
    expect(PROPOSAL_COPY_VARIANTS.budget.detailsTitle).toMatch(/orçamento/i);
    expect(PROPOSAL_COPY_VARIANTS.proposal.historyTrigger).not.toBe(
      PROPOSAL_COPY_VARIANTS.budget.historyTrigger,
    );
  });

  it("exposes the shared labels used by details and history UIs", () => {
    for (const variant of Object.values(PROPOSAL_COPY_VARIANTS)) {
      expect(variant.amountLabel).toBeTruthy();
      expect(variant.emptyHistory).toBeTruthy();
      expect(variant.photosHeading).toBeTruthy();
      expect(variant.editAction).toBeTruthy();
    }
  });
});
