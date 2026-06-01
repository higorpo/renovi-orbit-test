import { describe, expect, it } from "vitest";
import { resolveChatActionBanner } from "../chatActionBannerState";

describe("resolveChatActionBanner", () => {
  it("prioritizes provider revision over send proposal", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "provider",
      conversationStatus: "ACTIVE",
      pendingProposalId: "p-pending",
      revisionRequestedProposalId: "p-revision",
      primaryProposalStatus: "REVISION_REQUESTED",
    });

    expect(banner?.action).toBe("review_proposal");
    expect(banner?.proposalId).toBe("p-revision");
  });

  it("shows send proposal for provider without pending proposal", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "provider",
      conversationStatus: "ACTIVE",
      pendingProposalId: null,
      revisionRequestedProposalId: null,
    });

    expect(banner?.action).toBe("send_proposal");
  });

  it("shows view proposal for client with pending proposal", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "client",
      conversationStatus: "ACTIVE",
      pendingProposalId: "p-1",
      revisionRequestedProposalId: null,
    });

    expect(banner?.action).toBe("view_proposal");
    expect(banner?.ctaLabel).toBe("Ver proposta");
  });

  it("returns null when conversation is closed", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "client",
      conversationStatus: "CLOSED",
      pendingProposalId: "p-1",
      revisionRequestedProposalId: null,
    });

    expect(banner).toBeNull();
  });
});
