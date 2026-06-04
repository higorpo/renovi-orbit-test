// @vitest-environment happy-dom
import React, { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessageListItem } from "../../../types/chats.types";
import { DynamicProposalCard } from "../DynamicProposalCard";

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

vi.mock("@/features/negotiation-proposals/api/platformConstants.api", () => ({
  getProposalResponseSlaHours: vi.fn().mockResolvedValue(24),
}));

const hydrateMock = vi.fn();

vi.mock("../../../hooks/useProposalTimelineHydration", () => ({
  useProposalTimelineHydration: (...args: unknown[]) => hydrateMock(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function renderCard(ui: React.ReactElement) {
  return render(ui, { wrapper: createWrapper() });
}

const message: ChatMessageListItem = {
  id: "m1",
  chat_id: "c1",
  sender_user_id: "u2",
  message_type: "PROPOSAL",
  payload: { proposal_id: "p1", version: 1 },
  linked_entity_type: "proposal",
  linked_entity_id: "p1",
  idempotency_key: "k1",
  delivery_status: "SENT",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("DynamicProposalCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("hydrates proposal summary and opens details via callback", () => {
    hydrateMock.mockReturnValue({
      proposal: {
        status: "PENDING",
        proposed_amount: 500,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const onProposalAction = vi.fn();

    renderCard(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
        onProposalAction={onProposalAction}
      />,
    );

    expect(hydrateMock).toHaveBeenCalledWith("chat-1", "p1", true);
    expect(screen.getByText("R$ 500,00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes da proposta/i }));
    expect(onProposalAction).toHaveBeenCalledWith("view_details", "p1");
  });

  it("shows countdown for pending proposals with a client deadline", () => {
    hydrateMock.mockReturnValue({
      proposal: {
        status: "PENDING",
        proposed_amount: 500,
        submitted_at: "2026-01-01T00:00:00.000Z",
        client_response_deadline_at: "2026-01-01T03:00:00.000Z",
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderCard(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
        onProposalAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Restam 3 h/i)).toBeInTheDocument();
  });

  it("emits reject action when client taps Recusar", () => {
    hydrateMock.mockReturnValue({
      proposal: { status: "PENDING", proposed_amount: 500 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const onProposalAction = vi.fn();

    renderCard(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
        onProposalAction={onProposalAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Recusar$/i }));
    expect(onProposalAction).toHaveBeenCalledWith("reject", "p1");
  });

  it("disables request revision when client reached revision limit", () => {
    hydrateMock.mockReturnValue({
      proposal: { status: "PENDING", proposed_amount: 500, revision_count: 2 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const onProposalAction = vi.fn();

    renderCard(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
        onProposalAction={onProposalAction}
      />,
    );

    const revisionButton = screen.getByRole("button", { name: /^Pedir revisão$/i });
    expect(revisionButton).toBeDisabled();

    fireEvent.click(revisionButton);
    expect(onProposalAction).not.toHaveBeenCalled();
  });

  it("shows shimmer skeleton while proposal data is loading", () => {
    hydrateMock.mockReturnValue({
      proposal: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    renderCard(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
        onProposalAction={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Carregando proposta")).toBeInTheDocument();
    expect(screen.queryByText("Proposta enviada")).not.toBeInTheDocument();
  });

  it("shows client rejection response for provider on rejected proposal", () => {
    hydrateMock.mockReturnValue({
      proposal: {
        status: "REJECTED",
        proposed_amount: 500,
        client_rejection_response: "Preço acima do orçamento",
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderCard(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="provider"
        isOutgoing
        onProposalAction={vi.fn()}
      />,
    );

    expect(screen.getByText("Resposta do cliente sobre a rejeição")).toBeInTheDocument();
    expect(screen.getByText("Preço acima do orçamento")).toBeInTheDocument();
  });

  it("shows automatic rejection message for provider on REJECTED_AUTOMATICALLY", () => {
    hydrateMock.mockReturnValue({
      proposal: {
        status: "REJECTED_AUTOMATICALLY",
        proposed_amount: 500,
        client_rejection_response:
          "Proposta recusada automaticamente: prazo de 48 horas para resposta expirado.",
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderCard(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="provider"
        isOutgoing
        onProposalAction={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/prazo de 48 horas para resposta expirado/i),
    ).toBeInTheDocument();
  });

  it("hides rejection response for client on rejected proposal", () => {
    hydrateMock.mockReturnValue({
      proposal: {
        status: "REJECTED",
        proposed_amount: 500,
        client_rejection_response: "Preço acima do orçamento",
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderCard(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
        onProposalAction={vi.fn()}
      />,
    );

    expect(screen.queryByText("Resposta do cliente sobre a rejeição")).not.toBeInTheDocument();
  });

  it("shows revision category and notes for provider when revision was requested", () => {
    hydrateMock.mockReturnValue({
      proposal: {
        status: "REVISION_REQUESTED",
        proposed_amount: 500,
        revision_reason: "PRICE_TOO_HIGH",
        revision_notes: "Valor acima do orçamento previsto",
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderCard(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="provider"
        isOutgoing
        onProposalAction={vi.fn()}
      />,
    );

    expect(screen.getByText(/revisão solicitada pelo cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/preço alto/i)).toBeInTheDocument();
    expect(screen.getByText(/valor acima do orçamento previsto/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ver detalhes da revisão solicitada/i }),
    ).toBeInTheDocument();
  });

  it("hides revision request notice for client when revision was requested", () => {
    hydrateMock.mockReturnValue({
      proposal: {
        status: "REVISION_REQUESTED",
        proposed_amount: 500,
        revision_reason: "PRICE_TOO_HIGH",
        revision_notes: "Valor acima do orçamento previsto",
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderCard(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
        onProposalAction={vi.fn()}
      />,
    );

    expect(screen.queryByText(/revisão solicitada pelo cliente/i)).not.toBeInTheDocument();
  });
});
