import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ServiceModel } from "@/features/view-services";
import { ProviderServiceListCard } from "../ProviderServiceListCard";

vi.mock("@/features/request-quote", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/request-quote")>();
  return {
    ...actual,
    useServiceRequestPhotoUrls: vi.fn(() => ({ urls: [], isLoading: false })),
  };
});

const baseModel: ServiceModel = {
  id: "sr-1",
  title: "Instalação elétrica",
  description: null,
  descriptionPreview: "",
  formData: null,
  formSchema: null,
  listPhase: "negotiation",
  statusTabId: "negotiation",
  contractedServiceId: null,
  createdAt: "2025-03-01T00:00:00Z",
  updatedAt: "2025-03-01T00:00:00Z",
  address: { neighborhood: "Centro", cityName: "Florianópolis" },
  service: { title: "Eletricista", slug: "eletricista" },
  photoPaths: [],
  proposalCount: 1,
  hasPendingProposal: true,
  counterpartyName: "Maria",
  counterparty: { id: "c-1", displayName: "Maria" },
  contracted: null,
  tags: null,
  urgency: null,
  scopeComplexity: null,
  estimatedDurationHint: null,
  missingInfoWarnings: null,
  suggestedEquipment: null,
  suggestedMaterials: null,
  lastActivityAt: "2025-03-02T00:00:00Z",
  myProposal: {
    id: "p-1",
    status: "PENDING",
    finalAmount: 250,
    updatedAt: "2025-03-02T00:00:00Z",
    expiredAt: null,
  },
  chatSummary: { id: "chat-1", isUnread: true, lastInteractionAt: "2025-03-02T00:00:00Z" },
};

describe("ProviderServiceListCard", () => {
  it("renders masked client name and proposal value", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={baseModel} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByText(/250/)).toBeInTheDocument();
    expect(screen.getByText("Nova mensagem")).toBeInTheDocument();
  });

  it("disables chat action when chat is missing", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard
          model={{ ...baseModel, chatSummary: null }}
          onOpenChat={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Ver conversa/i })).toBeDisabled();
  });

  it("calls onOpenChat when chat exists", () => {
    const onOpenChat = vi.fn();
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={baseModel} onOpenChat={onOpenChat} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ver conversa/i }));
    expect(onOpenChat).toHaveBeenCalledWith(baseModel);
  });
});
