import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CurrentProposalVersionBlock } from "../CurrentProposalVersionBlock";
import type { ClientBudgetDetailProposal } from "../../types/client-budgets.types";

vi.mock("@/features/provider-jobs/hooks/useProviderProposalPhotoUrls", () => ({
  useProviderProposalPhotoUrls: () => ({ urls: ["https://photo/1"], isLoading: false }),
}));

vi.mock("@/features/provider-jobs/components/ProviderProposalPhotosGrid", () => ({
  ProviderProposalPhotosGrid: () => <div data-testid="photos-grid" />,
}));

const baseProposal: ClientBudgetDetailProposal = {
  id: "p1",
  provider_id: "prov1",
  provider_name: "Nome",
  provider_slug: "slug",
  provider_profile_image_path: null,
  proposed_amount: 1200,
  status: "submitted",
  created_at: "2024-01-01T00:00:00Z",
  proposal_description: "Texto do orçamento",
  photos: ["path/a.jpg"],
  client_response_deadline_at: "2030-12-31T15:00:00.000Z",
};

describe("CurrentProposalVersionBlock", () => {
  it("shows deadline banner when submitted and deadline parses", () => {
    render(<CurrentProposalVersionBlock proposal={baseProposal} />);
    expect(screen.getByText(/Versão atual/i)).toBeInTheDocument();
    expect(screen.getByText(/Prazo para responder/i)).toBeInTheDocument();
    expect(screen.getByText(/Texto do orçamento/)).toBeInTheDocument();
    expect(screen.getByTestId("photos-grid")).toBeInTheDocument();
  });

  it("hides deadline when status is not submitted", () => {
    render(
      <CurrentProposalVersionBlock
        proposal={{ ...baseProposal, status: "accepted", client_response_deadline_at: null }}
      />,
    );
    expect(screen.queryByText(/Prazo para responder/i)).not.toBeInTheDocument();
  });
});
