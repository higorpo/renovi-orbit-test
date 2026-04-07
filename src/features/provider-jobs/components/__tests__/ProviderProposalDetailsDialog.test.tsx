import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProviderProposalHistoryItem } from "../../api/providerProposals.api";
import { ProviderProposalDetailsDialog } from "../ProviderProposalDetailsDialog";

vi.mock("../../hooks/useProviderProposalPhotoUrls", () => ({
  useProviderProposalPhotoUrls: () => ({ urls: [], isLoading: false }),
}));

function baseProposal(
  overrides: Partial<ProviderProposalHistoryItem> = {},
): ProviderProposalHistoryItem {
  return {
    id: "p1",
    proposed_amount: 100,
    proposal_description: "Descrição",
    proposal_duration_value: 2,
    proposal_duration_unit: "hours",
    proposal_suggested_slots: [],
    status: "submitted",
    tax_rate: 0.1,
    tax_amount: 10,
    final_amount: 90,
    photos: [],
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-02T10:00:00.000Z",
    client_rejection_response: null,
    ...overrides,
  };
}

describe("ProviderProposalDetailsDialog", () => {
  it("renders nothing when proposal is null", () => {
    const { container } = render(
      <ProviderProposalDetailsDialog proposal={null} onOpenChange={vi.fn()} />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renders plural hours label", () => {
    render(
      <ProviderProposalDetailsDialog
        proposal={baseProposal({ proposal_duration_value: 3, proposal_duration_unit: "hours" })}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/horas/i)).toBeInTheDocument();
  });

  it("renders singular day label and date range for day-based slots", () => {
    render(
      <ProviderProposalDetailsDialog
        proposal={baseProposal({
          proposal_duration_value: 1,
          proposal_duration_unit: "days",
          proposal_suggested_slots: [
            {
              start_date: "2026-06-01",
              end_date: "2026-06-03",
              shift: "morning",
            },
          ],
        })}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/dia\b/i)).toBeInTheDocument();
    expect(screen.getByText(/até/i)).toBeInTheDocument();
  });

  it("shows rejection note when proposal was rejected with client message", () => {
    render(
      <ProviderProposalDetailsDialog
        proposal={baseProposal({
          status: "rejected",
          client_rejection_response: " Preço alto ",
        })}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Preço alto")).toBeInTheDocument();
  });

  it("invokes onOpenChange when dialog requests close", () => {
    const onOpenChange = vi.fn();
    render(
      <ProviderProposalDetailsDialog proposal={baseProposal()} onOpenChange={onOpenChange} />,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
