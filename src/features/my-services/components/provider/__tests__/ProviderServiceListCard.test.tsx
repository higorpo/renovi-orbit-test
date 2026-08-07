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

  it("renders Abrir no mapa and Concluir serviço for in_progress service scheduled today", () => {
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
    expect(screen.getByRole("button", { name: /Concluir serviço/i })).toBeInTheDocument();

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

  it("calls onMarkExecuted when Concluir serviço is clicked", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 8, 12, 0, 0));

    const onMarkExecuted = vi.fn();
    const pastDueModel: ServiceModel = {
      ...baseModel,
      listPhase: "in_progress",
      statusTabId: "in_progress",
      enrichmentReady: true,
      enrichmentStatus: "READY",
      executedLate: null,
      pendingProposalCount: 0,
      activeChatCount: 1,
      unreadChatCount: 0,
      chatSummary: {
        id: "chat-1",
        isUnread: false,
        lastInteractionAt: "2025-06-01T00:00:00Z",
        lastMessagePreview: null,
      },
      contracted: {
        id: "cs-1",
        status: "CONFIRMED",
        agreedSlot: null,
        durationUnit: "hours",
        durationValue: 5,
        scheduledStartDate: "2025-06-05",
        scheduledEndDate: null,
        scheduledShift: "full_day",
        provider: null,
        chatId: "chat-1",
        updatedAt: null,
      },
    };

    render(
      <MemoryRouter>
        <ProviderServiceListCard
          model={pastDueModel}
          onOpenDetails={vi.fn()}
          onMarkExecuted={onMarkExecuted}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Marque o serviço como executado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Ver detalhes$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Concluir serviço/i }));

    expect(onMarkExecuted).toHaveBeenCalledWith(pastDueModel);

    vi.useRealTimers();
  });

  it("renders Ver conversa and Ver detalhes for in_progress phase", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 8, 12, 0, 0));

    const inProgressModel: ServiceModel = {
      ...baseModel,
      listPhase: "in_progress",
      statusTabId: "in_progress",
      enrichmentReady: true,
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
    expect(screen.getByRole("button", { name: /^Ver detalhes$/i })).toBeInTheDocument();

    vi.useRealTimers();
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

describe("ProviderServiceListCard additional branches", () => {
  function contracted(
    overrides: Partial<NonNullable<ServiceModel["contracted"]>> = {},
  ): NonNullable<ServiceModel["contracted"]> {
    return {
      id: "cs-1",
      status: "CONFIRMED",
      agreedSlot: null,
      durationUnit: "hours",
      durationValue: 2,
      scheduledStartDate: "2025-06-15",
      scheduledEndDate: null,
      scheduledShift: "morning",
      provider: null,
      chatId: null,
      updatedAt: null,
      ...overrides,
    };
  }

  it("renders a completed card with one action", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard
          model={{
            ...baseModel,
            listPhase: "completed",
            statusTabId: "completed",
            completedAt: "2025-06-10T00:00:00Z",
            contracted: contracted({ status: "COMPLETED" }),
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Serviço concluído")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Ver detalhes" })).toBeInTheDocument();
  });

  it("renders cancellation detail and subdetail", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard
          model={{
            ...baseModel,
            listPhase: "cancelled",
            statusTabId: "cancelled",
            requestStatus: "CANCELLED",
            cancelledAt: "2025-06-05T12:00:00Z",
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Cliente desistiu da execução")).toBeInTheDocument();
    expect(screen.getByText(/Cancelado em 05\/06\/2025/)).toBeInTheDocument();
  });

  it("shows high urgency", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={{ ...baseModel, urgency: "high" }} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Urgente")).toBeInTheDocument();
  });

  it("renders an expired proposal", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard
          model={{
            ...baseModel,
            hasPendingProposal: false,
            chatSummary: null,
            myProposal: {
              ...baseModel.myProposal!,
              status: "EXPIRED",
              expiredAt: "2025-03-03T00:00:00Z",
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Proposta expirada")).toBeInTheDocument();
  });

  it("invites starting a chat without a proposal or conversation", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard
          model={{
            ...baseModel,
            hasPendingProposal: false,
            myProposal: null,
            chatSummary: null,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Inicie a conversa com o cliente")).toBeInTheDocument();
  });

  it("renders a non-interactive card body when details callback is omitted", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={baseModel} />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /Ver detalhes de Troca de disjuntor/i }),
    ).not.toBeInTheDocument();
  });

  it("disables today's map action without coordinates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-08T12:00:00Z"));

    try {
      render(
        <MemoryRouter>
          <ProviderServiceListCard
            model={{
              ...baseModel,
              listPhase: "in_progress",
              statusTabId: "in_progress",
              chatSummary: null,
              address: { neighborhood: "Centro", cityName: "Florianópolis" },
              contracted: contracted({ scheduledStartDate: "2025-06-08" }),
            }}
          />
        </MemoryRouter>,
      );

      expect(screen.getByRole("button", { name: "Abrir no mapa" })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to counterpartyName", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard
          model={{ ...baseModel, counterparty: null, counterpartyName: "Cliente legado" }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Cliente legado")).toBeInTheDocument();
  });

  it("renders pending payment in progress", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard
          model={{
            ...baseModel,
            listPhase: "in_progress",
            statusTabId: "in_progress",
            chatSummary: null,
            contracted: contracted({ status: "PENDING_PAYMENT" }),
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Aguardando pagamento do cliente")).toBeInTheDocument();
  });

  it("falls back to Cliente when client name is missing", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard
          model={{ ...baseModel, counterparty: null, counterpartyName: null }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Cliente")).toBeInTheDocument();
  });

  it("hides urgency badge when showUrgency is false", () => {
    render(
      <MemoryRouter>
        <ProviderServiceListCard model={{ ...baseModel, urgency: null }} />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/Urgente/i)).not.toBeInTheDocument();
  });

  it("renders the resolved client avatar image", async () => {
    const usePublicProfileImageUrl = vi.mocked(
      await import(
        "@/features/provider-profile/hooks/usePublicProfileImageUrl"
      ).then((module) => module.usePublicProfileImageUrl)
    );
    usePublicProfileImageUrl.mockReturnValue({
      url: "https://cdn.example/client.jpg",
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <ProviderServiceListCard model={baseModel} />
      </MemoryRouter>,
    );

    expect(usePublicProfileImageUrl).toHaveBeenCalledWith(null);
    expect(screen.getByText("MS")).toBeInTheDocument();
  });

  it("dispatches the details footer action", () => {
    const onOpenDetails = vi.fn();
    render(
      <MemoryRouter>
        <ProviderServiceListCard
          model={baseModel}
          onOpenDetails={onOpenDetails}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes" }));

    expect(onOpenDetails).toHaveBeenCalledWith(baseModel);
  });
});
