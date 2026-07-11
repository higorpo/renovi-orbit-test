// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DynamicProposalCardSkeleton } from "../DynamicProposalCardSkeleton";
import { DynamicRescheduleProposalCardSkeleton } from "../DynamicRescheduleProposalCardSkeleton";

describe("DynamicMessageRenderer skeletons", () => {
  it("aligns proposal skeleton to the outgoing side", () => {
    render(<DynamicProposalCardSkeleton isOutgoing className="extra" />);
    const root = screen.getByLabelText("Carregando proposta");
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root.className).toContain("ml-auto");
    expect(root.className).toContain("extra");
  });

  it("aligns proposal skeleton to the incoming side", () => {
    render(<DynamicProposalCardSkeleton isOutgoing={false} />);
    expect(screen.getByLabelText("Carregando proposta").className).toContain("mr-auto");
  });

  it("aligns reschedule skeleton to the outgoing side", () => {
    render(<DynamicRescheduleProposalCardSkeleton isOutgoing className="extra" />);
    const root = screen.getByLabelText("Carregando reagendamento");
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root.className).toContain("ml-auto");
    expect(root.className).toContain("extra");
  });

  it("aligns reschedule skeleton to the incoming side", () => {
    render(<DynamicRescheduleProposalCardSkeleton isOutgoing={false} />);
    expect(screen.getByLabelText("Carregando reagendamento").className).toContain(
      "mr-auto",
    );
  });
});
