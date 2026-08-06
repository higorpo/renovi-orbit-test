import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { ServiceRequestBudgetCompareProposal } from "../../types/serviceRequestBudgetCompare.types";
import { BudgetCompareProviderCard } from "../BudgetCompareProviderCard";
import { BudgetCompareProviderHeader } from "../BudgetCompareProviderHeader";
import { ServiceRequestBudgetCompareVersionBlock } from "../ServiceRequestBudgetCompareVersionBlock";
import { ServiceRequestBudgetStatusBadge } from "../ServiceRequestBudgetStatusBadge";

vi.mock("@/features/provider-profile/hooks/usePublicProfileImageUrl", () => ({
  usePublicProfileImageUrl: () => ({ url: null }),
}));

vi.mock("../../hooks/useProposalPhotoUrls", () => ({
  useProposalPhotoUrls: () => ({ urls: [], isLoading: false }),
}));

vi.mock("../ProposalCountdownBanner", () => ({
  ProposalCountdownBanner: () => <div data-testid="countdown-banner" />,
}));

const pendingProposal: ServiceRequestBudgetCompareProposal = {
  id: "proposal-1",
  provider_id: "provider-1",
  provider_name: "Ana Prestadora",
  provider_slug: "ana-prestadora",
  provider_profile_image_path: null,
  rating_avg: 4.5,
  rating_count: 8,
  completed_services_count: 22,
  proposed_amount: 350,
  revision_count: 0,
  status: "PENDING",
  submitted_at: "2026-07-01T10:00:00.000Z",
  created_at: "2026-07-01T10:00:00.000Z",
  proposal_description: "Troca completa do chuveiro.",
  proposal_suggested_slots: [{ start_date: "2026-07-12", shift: "morning" }],
  photos: [],
};

describe("ServiceRequestBudgetStatusBadge", () => {
  it("renders the label for a known status", () => {
    render(<ServiceRequestBudgetStatusBadge status="PENDING" />);
    expect(screen.getByText("Aguardando avaliação")).toBeInTheDocument();
  });
});

describe("BudgetCompareProviderHeader", () => {
  it("renders provider name, rating, and profile link", () => {
    render(
      <MemoryRouter>
        <BudgetCompareProviderHeader
          providerName="Ana Prestadora"
          providerSlug="ana-prestadora"
          providerProfileImagePath={null}
          ratingAvg={4.5}
          ratingCount={8}
          completedServicesCount={22}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Ana Prestadora")).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText(/22 serviços/)).toBeInTheDocument();
    expect(screen.queryByText("Sem avaliações")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver perfil" })).toHaveAttribute(
      "href",
      expect.stringContaining("ana-prestadora"),
    );
  });

  it("shows Sem avaliações when rating_count is zero", () => {
    render(
      <MemoryRouter>
        <BudgetCompareProviderHeader
          providerName="Novo Prestador"
          providerSlug="novo"
          providerProfileImagePath={null}
          ratingAvg={null}
          ratingCount={0}
          completedServicesCount={3}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sem avaliações")).toBeInTheDocument();
    expect(screen.getByText(/3 serviços/)).toBeInTheDocument();
    expect(screen.queryByText("4.5")).not.toBeInTheDocument();
  });

  it("hides the profile link when slug is missing", () => {
    render(
      <MemoryRouter>
        <BudgetCompareProviderHeader
          providerName="Sem slug"
          providerSlug={null}
          providerProfileImagePath={null}
          ratingAvg={null}
          ratingCount={0}
          completedServicesCount={0}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Ver perfil" })).not.toBeInTheDocument();
  });
});

describe("ServiceRequestBudgetCompareVersionBlock", () => {
  it("renders description, amount, and countdown for pending proposals", () => {
    render(<ServiceRequestBudgetCompareVersionBlock proposal={pendingProposal} />);

    expect(screen.getByText("Troca completa do chuveiro.")).toBeInTheDocument();
    expect(screen.getByText(/Valor proposto/)).toBeInTheDocument();
    expect(screen.getByTestId("countdown-banner")).toBeInTheDocument();
  });

  it("hides countdown when the proposal is not pending", () => {
    render(
      <ServiceRequestBudgetCompareVersionBlock
        proposal={{ ...pendingProposal, status: "REJECTED" }}
      />,
    );

    expect(screen.queryByTestId("countdown-banner")).not.toBeInTheDocument();
  });
});

describe("BudgetCompareProviderCard", () => {
  it("renders CTAs in compare mode for pending proposals", () => {
    const onProposalAction = vi.fn();
    render(
      <MemoryRouter>
        <BudgetCompareProviderCard
          proposal={pendingProposal}
          sheetMode="compare"
          onProposalAction={onProposalAction}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Aceitar/i }));
    expect(onProposalAction).toHaveBeenCalledWith("accept", "proposal-1");
  });

  it("hides CTAs outside compare mode", () => {
    render(
      <MemoryRouter>
        <BudgetCompareProviderCard
          proposal={pendingProposal}
          sheetMode="history"
          onProposalAction={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /Aceitar/i })).not.toBeInTheDocument();
  });
});
