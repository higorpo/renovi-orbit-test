// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceDetailRequestSections } from "../ServiceDetailRequestSections";
import type { ServiceModel } from "../../types/service.types";

vi.mock("../FormResponsesSummary", () => ({
  FormResponsesSummary: () => <div data-testid="form-summary" />,
}));

vi.mock("../ServicePhotoGallery", () => ({
  ServicePhotoGallery: () => <div data-testid="photo-gallery" />,
}));

vi.mock("../SuggestedItemsInfo", () => ({
  SuggestedItemsInfo: ({ ariaLabel }: { ariaLabel: string }) => (
    <button type="button" aria-label={ariaLabel} />
  ),
}));

function buildModel(overrides: Partial<ServiceModel> = {}): ServiceModel {
  return {
    id: "sr-1",
    title: "Pedido",
    description: "Descrição completa",
    descriptionPreview: "Descrição completa",
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
    photoPaths: ["a.jpg"],
    proposalCount: 0,
    hasPendingProposal: false,
    pendingProposalCount: 0,
    activeChatCount: 0,
    unreadChatCount: 0,
    counterpartyName: null,
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

describe("ServiceDetailRequestSections", () => {
  it("renders description, photos, and suggested items", () => {
    render(
      <ServiceDetailRequestSections
        model={buildModel()}
        suggestedEquipmentPt={["Escada"]}
        suggestedMaterialsPt={["Outro"]}
      />,
    );

    expect(screen.getByText("Descrição")).toBeInTheDocument();
    expect(screen.getByText("Descrição completa")).toBeInTheDocument();
    expect(screen.getByText("Fotos (1)")).toBeInTheDocument();
    expect(screen.getByText("Escada")).toBeInTheDocument();
    expect(screen.getByText("Outro")).toBeInTheDocument();
  });

  it("omits optional blocks when empty", () => {
    render(
      <ServiceDetailRequestSections
        model={buildModel({ description: null, photoPaths: [] })}
        suggestedEquipmentPt={[]}
        suggestedMaterialsPt={[]}
      />,
    );

    expect(screen.queryByText("Descrição")).not.toBeInTheDocument();
    expect(screen.queryByText(/Fotos/)).not.toBeInTheDocument();
    expect(screen.getByTestId("form-summary")).toBeInTheDocument();
  });
});
