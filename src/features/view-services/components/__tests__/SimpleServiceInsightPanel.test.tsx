// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ServiceModel } from "../../types/service.types";
import { SimpleServiceInsightPanel } from "../SimpleServiceInsightPanel";

const baseModel: ServiceModel = {
  id: "sr-1",
  title: "Pedido",
  description: null,
  descriptionPreview: "",
  formData: null,
  formSchema: null,
  listPhase: "negotiation",
  statusTabId: "negotiation",
  contractedServiceId: null,
  createdAt: "2026-06-01T08:00:00Z",
  updatedAt: "2026-06-01T08:00:00Z",
  address: null,
  service: null,
  photoPaths: [],
  proposalCount: 0,
  hasPendingProposal: false,
  counterpartyName: null,
  counterparty: null,
  contracted: null,
  tags: ["Residencial", "Interno"],
  urgency: "high",
  scopeComplexity: "medium",
  estimatedDurationHint: "2_to_4h",
  missingInfoWarnings: ["Fotos do local"],
  suggestedEquipment: null,
  suggestedMaterials: null,
};

describe("SimpleServiceInsightPanel", () => {
  it("groups scheduling and warnings into labeled sections", () => {
    render(<SimpleServiceInsightPanel model={baseModel} compact />);

    expect(screen.getByText("Resumo do pedido")).toBeTruthy();
    expect(screen.getByText("Prioridade")).toBeTruthy();
    expect(screen.getByText("Urgente")).toBeTruthy();
    expect(screen.getByText("Escopo")).toBeTruthy();
    expect(screen.getByText("Média")).toBeTruthy();
    expect(screen.getByText("Duração estimada")).toBeTruthy();
    expect(screen.getByText("2 a 4 horas")).toBeTruthy();
    expect(screen.queryByText("Tags do serviço")).toBeNull();
    expect(screen.queryByText("Residencial")).toBeNull();
    expect(screen.getByText("Informações pendentes")).toBeTruthy();
    expect(screen.getByText("Fotos do local")).toBeTruthy();
  });

  it("renders nothing when there are no insights", () => {
    const { container } = render(
      <SimpleServiceInsightPanel
        model={{
          ...baseModel,
          tags: null,
          urgency: null,
          scopeComplexity: null,
          estimatedDurationHint: null,
          missingInfoWarnings: null,
        }}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders non-compact warnings-only panel", () => {
    render(
      <SimpleServiceInsightPanel
        model={{
          ...baseModel,
          urgency: null,
          scopeComplexity: null,
          estimatedDurationHint: null,
          missingInfoWarnings: ["  Detalhe faltando  ", ""],
        }}
      />,
    );

    expect(screen.getByText("Informações pendentes")).toBeTruthy();
    expect(screen.getByText("Detalhe faltando")).toBeTruthy();
    expect(screen.queryByText("Resumo do pedido")).toBeNull();
  });
});
