// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { ServiceModel } from "@/features/view-services";
import { ChatDetailsServiceSection } from "../ChatDetailsServiceSection";

const useServiceMock = vi.fn();

vi.mock("@/features/view-services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/view-services")>();
  return {
    ...actual,
    useService: (...args: unknown[]) => useServiceMock(...args),
  };
});

const serviceModel: ServiceModel = {
  id: "sr-1",
  title: "Trocar tomada",
  description: "Tomada queimada",
  descriptionPreview: "Tomada queimada",
  formData: null,
  formSchema: null,
  listPhase: "negotiation",
  statusTabId: "negotiation",
  contractedServiceId: null,
  createdAt: "2026-06-01T08:00:00Z",
  updatedAt: "2026-06-01T08:00:00Z",
  address: {
    neighborhood: "Centro",
    cityName: "Curitiba",
    stateAbbreviation: "PR",
  },
  service: {
    title: "Eletricista",
    slug: "eletricista",
    icon_key: null,
    color_key: null,
  },
  photoPaths: [],
  proposalCount: 0,
  hasPendingProposal: false,
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
};

function renderSection(serviceRequestId = "sr-1") {
  return render(
    <MemoryRouter>
      <ChatDetailsServiceSection serviceRequestId={serviceRequestId} />
    </MemoryRouter>,
  );
}

describe("ChatDetailsServiceSection", () => {
  it("shows skeleton while loading", () => {
    useServiceMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    const { container } = renderSection();
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders card and detail link when service loads", () => {
    useServiceMock.mockReturnValue({
      data: serviceModel,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderSection();

    expect(screen.getByText("Trocar tomada")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver mais detalhes do serviço" })).toHaveAttribute(
      "href",
      "/dashboard/services/sr-1",
    );
  });

  it("shows retry when service fails to load", () => {
    useServiceMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    renderSection();

    expect(screen.getByText("Não foi possível carregar os detalhes do serviço.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
  });
});
