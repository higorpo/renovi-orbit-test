import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurrentProposalVersionBlock } from "../CurrentProposalVersionBlock";
import type { ClientBudgetDetailProposal } from "../../types/client-budgets.types";

const useProposalPhotoUrlsMock = vi.hoisted(() =>
  vi.fn((_photos: string[] | null) => ({ urls: ["https://photo/1"], isLoading: false })),
);

vi.mock("@/features/negotiation-proposals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/negotiation-proposals")>();
  return {
    ...actual,
    useProposalPhotoUrls: (paths: string[] | null) => useProposalPhotoUrlsMock(paths),
    ProposalPhotosGrid: () => <div data-testid="photos-grid" />,
  };
});

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
  beforeEach(() => {
    useProposalPhotoUrlsMock.mockImplementation(() => ({
      urls: ["https://photo/1"],
      isLoading: false,
    }));
    useProposalPhotoUrlsMock.mockClear();
  });

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

  it("hides deadline banner when deadline value is invalid", () => {
    render(
      <CurrentProposalVersionBlock
        proposal={{ ...baseProposal, client_response_deadline_at: "invalid-date" }}
      />,
    );
    expect(screen.queryByText(/Prazo para responder/i)).not.toBeInTheDocument();
  });

  it("passes null photo paths to hook when photos array is empty", () => {
    render(<CurrentProposalVersionBlock proposal={{ ...baseProposal, photos: [] }} />);
    expect(useProposalPhotoUrlsMock).toHaveBeenCalledWith(null);
  });
});
