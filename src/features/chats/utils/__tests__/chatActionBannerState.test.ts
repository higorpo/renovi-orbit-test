import { describe, expect, it } from "vitest";
import { resolveChatActionBanner } from "../chatActionBannerState";

const activeContext = {
  conversationStatus: "ACTIVE" as const,
  pendingProposalId: null,
  revisionRequestedProposalId: null,
};

describe("resolveChatActionBanner", () => {
  it("prioritizes provider revision over send proposal", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "provider",
      ...activeContext,
      pendingProposalId: "p-pending",
      revisionRequestedProposalId: "p-revision",
      primaryProposalStatus: "REVISION_REQUESTED",
      canShowSendProposalBanner: true,
      canShowCloseConversationBanner: true,
    });

    expect(banner?.action).toBe("review_proposal");
    expect(banner?.proposalId).toBe("p-revision");
  });

  it("does not show send proposal without minimum exchange", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "provider",
      ...activeContext,
      canShowSendProposalBanner: false,
      canShowCloseConversationBanner: false,
    });

    expect(banner).toBeNull();
  });

  it("shows send proposal for provider when exchange criteria are met", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "provider",
      ...activeContext,
      canShowSendProposalBanner: true,
      canShowCloseConversationBanner: false,
    });

    expect(banner?.action).toBe("send_proposal");
    expect(banner?.body).toContain("Já tem informações suficientes?");
  });

  it("shows close conversation for provider after inactivity", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "provider",
      ...activeContext,
      canShowSendProposalBanner: false,
      canShowCloseConversationBanner: true,
    });

    expect(banner?.action).toBe("close_conversation");
  });

  it("prioritizes send proposal over close conversation for provider", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "provider",
      ...activeContext,
      canShowSendProposalBanner: true,
      canShowCloseConversationBanner: true,
    });

    expect(banner?.action).toBe("send_proposal");
  });

  it("shows view proposal for client with pending proposal", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "client",
      ...activeContext,
      pendingProposalId: "p-1",
      canShowCloseConversationBanner: true,
    });

    expect(banner?.action).toBe("view_proposal");
    expect(banner?.ctaLabel).toBe("Ver proposta");
  });

  it("does not show close conversation for client without inactivity", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "client",
      ...activeContext,
      canShowCloseConversationBanner: false,
    });

    expect(banner).toBeNull();
  });

  it("shows close conversation for client after inactivity", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "client",
      ...activeContext,
      canShowCloseConversationBanner: true,
    });

    expect(banner?.action).toBe("close_conversation");
  });

  it("returns null when conversation is closed", () => {
    const banner = resolveChatActionBanner({
      viewerRole: "client",
      conversationStatus: "CLOSED",
      pendingProposalId: "p-1",
      revisionRequestedProposalId: null,
      canShowCloseConversationBanner: true,
    });

    expect(banner).toBeNull();
  });
});
