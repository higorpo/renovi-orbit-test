// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatDetailsAcceptedProposalSection } from "../ChatDetailsAcceptedProposalSection";

describe("ChatDetailsAcceptedProposalSection", () => {
  it("renders amount, slot and opens details on button click", () => {
    const onViewDetails = vi.fn();

    render(
      <ChatDetailsAcceptedProposalSection
        acceptedProposal={{
          id: "prop-1",
          proposed_amount: 350,
          selected_slot: { start_date: "2026-06-12", shift: "afternoon" },
        }}
        viewerRole="client"
        onViewDetails={onViewDetails}
      />,
    );

    expect(screen.getByText("R$ 350,00")).toBeTruthy();
    expect(screen.getByText(/12\/06\/2026/)).toBeTruthy();
    expect(screen.getByText(/Tarde/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes da proposta" }));
    expect(onViewDetails).toHaveBeenCalledWith("prop-1");
  });

  it("shows provider receive amount when final_amount is available", () => {
    render(
      <ChatDetailsAcceptedProposalSection
        acceptedProposal={{
          id: "prop-1",
          proposed_amount: 350,
          final_amount: 280,
          selected_slot: { start_date: "2026-06-12", shift: "morning" },
        }}
        viewerRole="provider"
        onViewDetails={vi.fn()}
      />,
    );

    expect(screen.getByText("Valor a receber")).toBeTruthy();
    expect(screen.getByText("R$ 280,00")).toBeTruthy();
  });

  it("falls back to proposed amount for provider when final_amount is missing", () => {
    render(
      <ChatDetailsAcceptedProposalSection
        acceptedProposal={{
          id: "prop-1",
          proposed_amount: 350,
          selected_slot: { start_date: "2026-06-12", shift: "morning" },
        }}
        viewerRole="provider"
        onViewDetails={vi.fn()}
      />,
    );

    expect(screen.getByText("R$ 350,00")).toBeTruthy();
  });

  it("shows unavailable slot copy when selected_slot is missing", () => {
    render(
      <ChatDetailsAcceptedProposalSection
        acceptedProposal={{
          id: "prop-1",
          proposed_amount: 350,
          selected_slot: null,
        }}
        viewerRole="client"
        onViewDetails={vi.fn()}
        className="extra-section"
      />,
    );

    expect(screen.getByText("Data e turno indisponíveis")).toBeTruthy();
  });
});
