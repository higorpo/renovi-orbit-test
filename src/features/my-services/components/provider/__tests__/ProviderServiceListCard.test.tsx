import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ServiceModel } from "@/features/view-services";
import { ProviderServiceListCard } from "../ProviderServiceListCard";

vi.mock("@/features/provider-profile/hooks/usePublicProfileImageUrl", () => ({
  usePublicProfileImageUrl: vi.fn(() => ({ url: "", isLoading: false })),
}));

const baseModel: ServiceModel = {
  id: "sr-1",
  title: "Troca de disjuntor com quedas frequentes de energia",
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
  counterpartyName: "Maria Silva",
  counterparty: { id: "c-1", displayName: "Maria Silva", profileImagePath: null },
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
    submittedAt: "2025-03-02T00:00:00Z",
    revisionReason: null,
    revisionNotes: null,
    clientRejectionResponse: null,
  },
  chatSummary: {
    id: "chat-1",
    isUnread: true,
    lastInteractionAt: "2025-03-02T00:00:00Z",
    lastMessagePreview: "Você consegue realizar ainda essa semana?",
  },
  requestStatus: "OPEN",
  cancelledAt: null,
  completedAt: null,
};

describe("ProviderServiceListCard", () => {
  it("renders client name, title, highlight and unread badge", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={baseModel} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText(/Troca de disjuntor/i)).toBeInTheDocument();
    expect(screen.getByText(/Nova mensagem recebida/i)).toBeInTheDocument();
    expect(screen.getByText(/Você consegue realizar/i)).toBeInTheDocument();
  });

  it("shows Responder as primary when unread", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={baseModel} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Responder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver detalhes/i })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /Ver negociação/i })).toBeDisabled();
  });

  it("calls onOpenChat when Responder is clicked", () => {
    const onOpenChat = vi.fn();
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={baseModel} onOpenChat={onOpenChat} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Responder/i }));
    expect(onOpenChat).toHaveBeenCalledWith(baseModel);
  });

  it("renders Abrir no mapa and Ver detalhes for in_progress service scheduled today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-08T12:00:00Z"));

    const inProgressTodayModel: ServiceModel = {
      ...baseModel,
      listPhase: "in_progress",
      statusTabId: "in_progress",
      chatSummary: {
        id: "chat-1",
        isUnread: false,
        lastInteractionAt: "2025-03-02T00:00:00Z",
        lastMessagePreview: null,
      },
      address: {
        neighborhood: "Centro",
        cityName: "Florianópolis",
        latitude: -27.5954,
        longitude: -48.548,
      },
      contracted: {
        id: "cs-1",
        status: "CONFIRMED",
        agreedSlot: null,
        durationUnit: "hours",
        durationValue: 5,
        scheduledStartDate: "2025-06-08",
        scheduledEndDate: null,
        scheduledShift: "morning",
        provider: null,
        chatId: null,
        updatedAt: null,
      },
    };
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={inProgressTodayModel} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Abrir no mapa/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver detalhes/i })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("calls onOpenMap when Abrir no mapa is clicked", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-08T12:00:00Z"));
    const onOpenMap = vi.fn();
    const inProgressTodayModel: ServiceModel = {
      ...baseModel,
      listPhase: "in_progress",
      statusTabId: "in_progress",
      chatSummary: {
        id: "chat-1",
        isUnread: false,
        lastInteractionAt: "2025-03-02T00:00:00Z",
        lastMessagePreview: null,
      },
      address: {
        neighborhood: "Centro",
        cityName: "Florianópolis",
        latitude: -27.5954,
        longitude: -48.548,
      },
      contracted: {
        id: "cs-1",
        status: "CONFIRMED",
        agreedSlot: null,
        durationUnit: "hours",
        durationValue: 5,
        scheduledStartDate: "2025-06-08",
        scheduledEndDate: null,
        scheduledShift: "morning",
        provider: null,
        chatId: null,
        updatedAt: null,
      },
    };
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={inProgressTodayModel} onOpenMap={onOpenMap} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Abrir no mapa/i }));
    expect(onOpenMap).toHaveBeenCalledWith(inProgressTodayModel);
    vi.useRealTimers();
  });

  it("renders Ver conversa and Ver detalhes for in_progress phase", () => {
    const inProgressModel: ServiceModel = {
      ...baseModel,
      listPhase: "in_progress",
      statusTabId: "in_progress",
      chatSummary: {
        id: "chat-1",
        isUnread: false,
        lastInteractionAt: "2025-03-02T00:00:00Z",
        lastMessagePreview: null,
      },
      contracted: {
        id: "cs-1",
        status: "CONFIRMED",
        agreedSlot: null,
        durationUnit: "hours",
        durationValue: 5,
        scheduledStartDate: "2025-06-15",
        scheduledEndDate: null,
        scheduledShift: "morning",
        provider: null,
        chatId: null,
        updatedAt: null,
      },
    };
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={inProgressModel} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Ver conversa/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver detalhes/i })).toBeInTheDocument();
  });

  it("renders Revisar proposta primary button for REVISION_REQUESTED proposal status", () => {
    const revisionModel: ServiceModel = {
      ...baseModel,
      chatSummary: {
        id: "chat-1",
        isUnread: false,
        lastInteractionAt: "2025-03-02T00:00:00Z",
        lastMessagePreview: null,
      },
      myProposal: {
        ...baseModel.myProposal!,
        status: "REVISION_REQUESTED",
        revisionReason: "PRICE_TOO_HIGH",
        revisionNotes: "Valor alto demais",
      },
    };
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={revisionModel} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Revisar proposta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver negociação/i })).toBeInTheDocument();
  });

  it("calls onReviseProposal when Revisar proposta is clicked", () => {
    const onReviseProposal = vi.fn();
    const revisionModel: ServiceModel = {
      ...baseModel,
      chatSummary: {
        id: "chat-1",
        isUnread: false,
        lastInteractionAt: "2025-03-02T00:00:00Z",
        lastMessagePreview: null,
      },
      myProposal: {
        ...baseModel.myProposal!,
        status: "REVISION_REQUESTED",
      },
    };
    render(
      <MemoryRouter>
        <ProviderServiceListCard
          model={revisionModel}
          onReviseProposal={onReviseProposal}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Revisar proposta/i }));
    expect(onReviseProposal).toHaveBeenCalledWith(revisionModel);
  });

  it("calls onOpenDetails when the card body is clicked", () => {
    const onOpenDetails = vi.fn();
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={baseModel} onOpenDetails={onOpenDetails} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes de Troca de disjuntor/i }));
    expect(onOpenDetails).toHaveBeenCalledWith(baseModel);
  });

  it("calls onViewProposal when Ver proposta is clicked", () => {
    const onViewProposal = vi.fn();
    const proposalModel: ServiceModel = {
      ...baseModel,
      chatSummary: {
        id: "chat-1",
        isUnread: false,
        lastInteractionAt: "2025-03-02T00:00:00Z",
        lastMessagePreview: null,
      },
    };
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={proposalModel} onViewProposal={onViewProposal} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ver proposta/i }));
    expect(onViewProposal).toHaveBeenCalledWith(proposalModel);
  });
});
