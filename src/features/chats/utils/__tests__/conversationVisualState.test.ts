import { describe, expect, it } from "vitest";
import {
  getConversationStatusPresentation,
  getProposalCardSurfaceClass,
} from "../conversationVisualState";

describe("conversationVisualState", () => {
  it("dims INACTIVE and CLOSED list rows and shows badges in list", () => {
    const inactive = getConversationStatusPresentation("INACTIVE");
    expect(inactive.showInList).toBe(true);
    expect(inactive.listItemClassName).toContain("opacity");

    const closed = getConversationStatusPresentation("CLOSED");
    expect(closed.showInList).toBe(true);

    const active = getConversationStatusPresentation("ACTIVE");
    expect(active.showInList).toBe(false);
  });

  it("maps proposal statuses to distinct surfaces", () => {
    expect(getProposalCardSurfaceClass("PENDING")).toContain("primary");
    expect(getProposalCardSurfaceClass("ACCEPTED")).toContain("emerald");
    expect(getProposalCardSurfaceClass("EXPIRED")).toContain("muted");
  });
});
