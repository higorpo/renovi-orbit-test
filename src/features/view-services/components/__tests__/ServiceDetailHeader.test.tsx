// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceDetailHeader } from "../ServiceDetailHeader";
import type { ServiceModel } from "../../types/service.types";

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({
    color: "from-blue-500 to-blue-600",
    Icon: () => <span data-testid="service-icon" />,
  }),
}));

vi.mock("../SimpleServiceInsightPanel", () => ({
  SimpleServiceInsightPanel: () => <div data-testid="insight-panel" />,
}));

function buildModel(overrides: Partial<ServiceModel> = {}): ServiceModel {
  return {
    id: "sr-1",
    title: "Troca de chuveiro",
    description: null,
    descriptionPreview: "",
    formData: null,
    formSchema: null,
    listPhase: "negotiation",
    statusTabId: "negotiation",
    contractedServiceId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    requestStatus: null,
    cancelledAt: null,
    completedAt: null,
    address: {
      neighborhood: "Centro",
      cityName: "Florianópolis",
      stateAbbreviation: "SC",
    },
    service: {
      title: "Encanador",
      slug: "encanador",
      icon_key: null,
      color_key: null,
    },
    photoPaths: [],
    proposalCount: 1,
    hasPendingProposal: false,
    pendingProposalCount: 0,
    activeChatCount: 0,
    unreadChatCount: 0,
    counterpartyName: "Maria",
    counterparty: null,
    contracted: null,
    tags: null,
    urgency: null,
    scopeComplexity: null,
    estimatedDurationHint: null,
    missingInfoWarnings: null,
    suggestedEquipment: null,
    suggestedMaterials: null,
    lastActivityAt: null,
    myProposal: null,
    chatSummary: null,
    ...overrides,
  };
}

describe("ServiceDetailHeader", () => {
  it("renders title, location, and client proposal count", () => {
    render(
      <ServiceDetailHeader model={buildModel()} isClient isProvider={false} />,
    );

    expect(screen.getByRole("heading", { name: "Troca de chuveiro" })).toBeInTheDocument();
    expect(screen.getByText("Encanador")).toBeInTheDocument();
    expect(screen.getByText(/Centro, Florianópolis/)).toBeInTheDocument();
    expect(screen.getByText(/1 orçamento recebido/)).toBeInTheDocument();
  });

  it("shows requester name for providers and plural proposal count for clients", () => {
    render(
      <ServiceDetailHeader
        model={buildModel({ proposalCount: 3, counterpartyName: "Ana" })}
        isClient={false}
        isProvider
      />,
    );

    expect(screen.getByText(/Solicitante:/)).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("handles missing service and location", () => {
    render(
      <ServiceDetailHeader
        model={buildModel({ service: null, address: null, proposalCount: 0 })}
        isClient
        isProvider={false}
      />,
    );

    expect(screen.getByText(/0 orçamentos recebidos/)).toBeInTheDocument();
  });
});
