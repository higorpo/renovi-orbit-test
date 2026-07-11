import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProposalDetailView } from "../../types/proposalDetails.types";
import type { ProviderProposalHistoryItem } from "../../types/proposals.types";
import { ProposalHistoryDetailContent } from "../ProposalHistoryDetailContent";

vi.mock("../ProposalCountdownBanner", () => ({
  ProposalCountdownBanner: ({
    audience,
    expiresAt,
  }: {
    audience: string;
    expiresAt: string | null;
  }) => (
    <div data-testid="countdown-banner">
      {audience}:{expiresAt ?? "none"}
    </div>
  ),
}));

vi.mock("../ProposalPhotosGrid", () => ({
  ProposalPhotosGrid: ({
    heading,
    isLoading,
  }: {
    heading: string;
    isLoading: boolean;
  }) => (
    <div data-testid="photos-grid">
      {heading}
      {isLoading ? "loading" : "ready"}
    </div>
  ),
}));

const historyItem: ProviderProposalHistoryItem = {
  id: "hist-1",
  proposed_amount: 800,
  proposal_description: "Descrição completa",
  proposal_duration_value: 2,
  proposal_duration_unit: "days",
  proposal_suggested_slots: [
    { start_date: "2026-04-01", end_date: "2026-04-03", shift: "morning" },
  ],
  status: "PENDING",
  tax_rate: 0.1,
  tax_amount: 80,
  final_amount: 720,
  photos: ["path/a.jpg"],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  client_rejection_response: null,
  revision_reason: null,
  revision_notes: null,
};

const clientDetail: ProposalDetailView = {
  id: "p1",
  service_request_id: "sr-1",
  provider_id: "provider-1",
  status: "PENDING",
  version: 1,
  revision_count: 0,
  revision_reason: null,
  revision_notes: null,
  submitted_at: "2026-01-01T10:00:00Z",
  expired_at: null,
  expires_at: "2026-01-02T10:00:00Z",
  proposed_amount: 500,
  proposal_description: null,
  proposal_duration_value: 1,
  proposal_duration_unit: "hours",
  proposal_suggested_slots: [{ start_date: "2026-04-01", end_date: null, shift: "afternoon" }],
  selected_slot: null,
  photos: [],
  client_rejection_response: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("ProposalHistoryDetailContent", () => {
  it("renders provider pricing fields when tax and final amount exist", () => {
    render(
      <ProposalHistoryDetailContent
        proposal={historyItem}
        copyVariant="budget"
        photoUrls={["https://x/1.jpg"]}
        isPhotosLoading={false}
      />,
    );

    expect(screen.getByText(/valor informado/i)).toBeInTheDocument();
    expect(screen.getByText(/taxa da plataforma/i)).toBeInTheDocument();
    expect(screen.getByText(/\(10%\)/)).toBeInTheDocument();
    expect(screen.getByText(/valor a receber/i)).toBeInTheDocument();
    expect(screen.getByText(/descrição completa/i)).toBeInTheDocument();
    expect(screen.getByText(/2 dias/i)).toBeInTheDocument();
    expect(screen.getByText(/opção 1:/i)).toBeInTheDocument();
    expect(screen.getByText(/até/i)).toBeInTheDocument();
    expect(screen.getByTestId("photos-grid")).toHaveTextContent("ready");
  });

  it("uses client amount label and status when provider pricing is absent", () => {
    render(
      <ProposalHistoryDetailContent
        proposal={clientDetail}
        copyVariant="proposal"
        photoUrls={[]}
        isPhotosLoading
        detailAudience="client"
      />,
    );

    expect(screen.getByText("Valor")).toBeInTheDocument();
    expect(screen.queryByText(/taxa da plataforma/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/valor a receber/i)).not.toBeInTheDocument();
    expect(screen.getByText(/1 hora/i)).toBeInTheDocument();
    expect(screen.getByTestId("countdown-banner")).toHaveTextContent(
      "client:2026-01-02T10:00:00Z",
    );
    expect(screen.getByTestId("photos-grid")).toHaveTextContent("loading");
  });

  it("formats singular day duration and hour slots without end date", () => {
    render(
      <ProposalHistoryDetailContent
        proposal={{
          ...historyItem,
          proposal_duration_value: 1,
          proposal_duration_unit: "days",
          proposal_suggested_slots: [
            { start_date: "2026-05-01", end_date: null, shift: "evening" },
          ],
        }}
        copyVariant="budget"
        photoUrls={[]}
        isPhotosLoading={false}
      />,
    );

    expect(screen.getByText(/1 dia/i)).toBeInTheDocument();
    expect(screen.getByText(/opção 1:/i)).toBeInTheDocument();
    expect(screen.queryByText(/até/i)).not.toBeInTheDocument();
  });

  it("formats plural hours when duration unit is hours", () => {
    render(
      <ProposalHistoryDetailContent
        proposal={{
          ...historyItem,
          proposal_duration_value: 3,
          proposal_duration_unit: "hours",
          proposal_suggested_slots: [],
        }}
        copyVariant="budget"
        photoUrls={[]}
        isPhotosLoading={false}
      />,
    );

    expect(screen.getByText(/3 horas/i)).toBeInTheDocument();
  });

  it("shows revision and rejection notices when present", () => {
    render(
      <ProposalHistoryDetailContent
        proposal={{
          ...historyItem,
          status: "REJECTED",
          revision_reason: "PRICE_TOO_HIGH",
          revision_notes: "Ajuste o valor",
          client_rejection_response: "Muito caro",
        }}
        copyVariant="budget"
        photoUrls={[]}
        isPhotosLoading={false}
      />,
    );

    expect(screen.getByText(/revisão solicitada pelo cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/ajuste o valor/i)).toBeInTheDocument();
    expect(screen.getByText(/muito caro/i)).toBeInTheDocument();
  });

  it("omits countdown when detailAudience is not provided", () => {
    render(
      <ProposalHistoryDetailContent
        proposal={clientDetail}
        copyVariant="proposal"
        photoUrls={[]}
        isPhotosLoading={false}
      />,
    );

    expect(screen.queryByTestId("countdown-banner")).not.toBeInTheDocument();
  });

  it("omits duration section when duration value is missing", () => {
    render(
      <ProposalHistoryDetailContent
        proposal={{
          ...historyItem,
          proposal_description: null,
          proposal_duration_value: null,
          proposal_suggested_slots: [],
        }}
        copyVariant="budget"
        photoUrls={[]}
        isPhotosLoading={false}
      />,
    );

    expect(screen.queryByText(/prazo estimado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/datas sugeridas/i)).not.toBeInTheDocument();
  });

  it("treats null duration unit as hours and ignores non-string expires_at", () => {
    render(
      <ProposalHistoryDetailContent
        proposal={{
          ...clientDetail,
          expires_at: null,
          proposal_duration_value: 2,
          proposal_duration_unit: null,
          proposal_suggested_slots: [],
        }}
        copyVariant="proposal"
        photoUrls={[]}
        isPhotosLoading={false}
        detailAudience="client"
      />,
    );

    expect(screen.getByText(/2 horas/i)).toBeInTheDocument();
    expect(screen.getByTestId("countdown-banner")).toHaveTextContent("client:none");
  });
});
