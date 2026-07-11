import { describe, expect, it } from "vitest";
import {
  CheckCircle2,
  Circle,
  CircleDot,
  CircleOff,
  Clock,
  Lock,
  XCircle,
} from "lucide-react";
import {
  getConversationStatusPresentation,
  getProposalCardSurfaceClass,
  getProposalStatusIcon,
} from "../conversationVisualState";

describe("conversationVisualState", () => {
  it("dims INACTIVE and CLOSED list rows and shows badges in list", () => {
    const inactive = getConversationStatusPresentation("INACTIVE");
    expect(inactive.showInList).toBe(true);
    expect(inactive.listItemClassName).toContain("opacity");
    expect(inactive.Icon).toBe(CircleOff);
    expect(inactive.label).toBe("Inativa");

    const closed = getConversationStatusPresentation("CLOSED");
    expect(closed.showInList).toBe(true);
    expect(closed.Icon).toBe(Lock);
    expect(closed.label).toBe("Encerrada");

    const active = getConversationStatusPresentation("ACTIVE");
    expect(active.showInList).toBe(false);
    expect(active.Icon).toBe(Circle);
    expect(active.label).toBe("Ativa");
  });

  it("maps proposal statuses to distinct surfaces", () => {
    expect(getProposalCardSurfaceClass("PENDING")).toContain("primary");
    expect(getProposalCardSurfaceClass("ACCEPTED")).toContain("emerald");
    expect(getProposalCardSurfaceClass("EXPIRED")).toContain("muted");
    expect(getProposalCardSurfaceClass("REVISED")).toContain("amber");
    expect(getProposalCardSurfaceClass("REVISION_REQUESTED")).toContain("amber");
    expect(getProposalCardSurfaceClass("REJECTED")).toContain("destructive");
    expect(getProposalCardSurfaceClass("REJECTED_AUTOMATICALLY")).toContain("destructive");
  });

  it("falls back to a neutral surface for unknown proposal statuses", () => {
    expect(getProposalCardSurfaceClass("NOT_A_REAL_STATUS")).toContain("border-border/70");
  });

  it("maps proposal statuses to distinct icons", () => {
    expect(getProposalStatusIcon("PENDING")).toBe(Clock);
    expect(getProposalStatusIcon("ACCEPTED")).toBe(CheckCircle2);
    expect(getProposalStatusIcon("EXPIRED")).toBe(CircleOff);
    expect(getProposalStatusIcon("REJECTED")).toBe(XCircle);
    expect(getProposalStatusIcon("REJECTED_AUTOMATICALLY")).toBe(XCircle);
    expect(getProposalStatusIcon("REVISED")).toBe(CircleDot);
    expect(getProposalStatusIcon("REVISION_REQUESTED")).toBe(CircleDot);
    expect(getProposalStatusIcon("UNKNOWN_STATUS")).toBe(Circle);
  });
});
