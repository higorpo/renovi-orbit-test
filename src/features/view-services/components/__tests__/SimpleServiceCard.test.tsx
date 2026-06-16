// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ServiceModel } from "../../types/service.types";
import { SimpleServiceCard } from "../SimpleServiceCard";

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({
    color: "from-blue-500 to-blue-600",
    Icon: () => <span data-testid="service-icon" />,
  }),
}));

const model: ServiceModel = {
  id: "sr-1",
  title: "Instalação elétrica - 5 pontos novos",
  description: "Preciso instalar 5 pontos de tomada novos.",
  descriptionPreview: "Preciso instalar 5 pontos de tomada novos.",
  formData: null,
  formSchema: null,
  listPhase: "negotiation",
  statusTabId: "negotiation",
  contractedServiceId: null,
  createdAt: "2026-06-05T13:48:59.185593+00:00",
  updatedAt: "2026-06-05T13:48:59.185593+00:00",
  address: {
    neighborhood: "Centro",
    cityName: "Florianópolis",
    stateAbbreviation: "SC",
  },
  service: {
    title: "Instalação elétrica",
    slug: "instalacao-eletrica",
    icon_key: "Zap",
    color_key: "yellow_orange",
  },
  photoPaths: [],
  proposalCount: 1,
  hasPendingProposal: false,
  counterpartyName: null,
  counterparty: null,
  contracted: null,
  tags: null,
  urgency: "medium",
  scopeComplexity: null,
  estimatedDurationHint: null,
  missingInfoWarnings: null,
  suggestedEquipment: null,
  suggestedMaterials: null,
};

describe("SimpleServiceCard", () => {
  it("renders essential service summary fields", () => {
    render(<SimpleServiceCard model={model} />);

    expect(screen.getByText("Instalação elétrica")).toBeTruthy();
    expect(screen.getByText("Instalação elétrica - 5 pontos novos")).toBeTruthy();
    expect(screen.getByText(/Centro, Florianópolis/)).toBeTruthy();
    expect(screen.getByText(/Solicitado em/)).toBeTruthy();
  });

  it("renders compact layout without status badge", () => {
    render(<SimpleServiceCard model={model} compact />);

    expect(screen.queryByText("Em negociação")).toBeNull();
    expect(screen.getByText(/Centro, Florianópolis \(SC\)/)).toBeTruthy();
    expect(screen.getByText(/Solicitado em/)).toBeTruthy();
    expect(screen.getByText("Resumo do pedido")).toBeTruthy();
    expect(screen.getByText("Média prioridade")).toBeTruthy();
  });

  it("shows full street line when address includes street summary", () => {
    const fullAddressModel: ServiceModel = {
      ...model,
      address: {
        neighborhood: "Centro",
        cityName: "Florianópolis",
        stateAbbreviation: "SC",
        streetSummary: "Rua Felipe Schmidt, 515",
        street: "Rua Felipe Schmidt",
        number: "515",
      },
    };

    render(<SimpleServiceCard model={fullAddressModel} compact />);

    expect(
      screen.getByText("Rua Felipe Schmidt, 515 - Centro, Florianópolis (SC)"),
    ).toBeTruthy();
  });

});
