// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceDetailAttributeCards } from "../ServiceDetailAttributeCards";
import type { ServiceModel } from "../../types/service.types";

function buildModel(overrides: Partial<ServiceModel> = {}): ServiceModel {
  return {
    id: "sr-1",
    title: "Pedido",
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
    address: null,
    service: null,
    photoPaths: [],
    proposalCount: 0,
    hasPendingProposal: false,
    pendingProposalCount: 0,
    activeChatCount: 0,
    unreadChatCount: 0,
    counterpartyName: null,
    counterparty: null,
    contracted: null,
    tags: null,
    urgency: "medium",
    scopeComplexity: "complex",
    estimatedDurationHint: "1_day",
    missingInfoWarnings: ["Autorização do condomínio pendente"],
    suggestedEquipment: null,
    suggestedMaterials: null,
    lastActivityAt: null,
    myProposal: null,
    chatSummary: null,
    enrichmentStatus: null,
    enrichmentReady: false,
    ...overrides,
  };
}

describe("ServiceDetailAttributeCards", () => {
  it("renders attribute cards and pending warnings for providers", () => {
    render(<ServiceDetailAttributeCards model={buildModel()} showPendingInfo />);

    expect(screen.getByTestId("service-detail-attribute-cards")).toBeInTheDocument();
    expect(screen.getByText("Prioridade")).toBeInTheDocument();
    expect(screen.getByText("Média")).toBeInTheDocument();
    expect(screen.getByText("Duração estimada")).toBeInTheDocument();
    expect(screen.getByText("1 dia")).toBeInTheDocument();
    expect(screen.getByText("Escopo")).toBeInTheDocument();
    expect(screen.getByText("Complexo")).toBeInTheDocument();
    expect(screen.getByTestId("service-detail-pending-info")).toBeInTheDocument();
    expect(screen.getByText(/Autorização do condomínio/)).toBeInTheDocument();
  });

  it("hides pending warnings for clients", () => {
    render(<ServiceDetailAttributeCards model={buildModel()} showPendingInfo={false} />);

    expect(screen.getByText("Prioridade")).toBeInTheDocument();
    expect(screen.queryByTestId("service-detail-pending-info")).not.toBeInTheDocument();
  });

  it("returns null when there is nothing to show", () => {
    const { container } = render(
      <ServiceDetailAttributeCards
        model={buildModel({
          urgency: null,
          scopeComplexity: null,
          estimatedDurationHint: null,
          missingInfoWarnings: null,
        })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
