// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessageListItem } from "../../../types/chats.types";
import { DynamicRescheduleProposalCard } from "../DynamicRescheduleProposalCard";

const hydrateMock = vi.fn();
const metricsCountMock = vi.fn();

vi.mock("@/lib/sentry", () => ({
  metrics: { count: (...args: unknown[]) => metricsCountMock(...args), distribution: vi.fn() },
}));

vi.mock("@/features/service-reschedule", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/service-reschedule")>();
  return {
    ...actual,
    useRescheduleTimelineHydration: (...args: unknown[]) => hydrateMock(...args),
  };
});

const message: ChatMessageListItem = {
  id: "m-reschedule",
  chat_id: "chat-1",
  sender_user_id: "provider-1",
  message_type: "WORKFLOW",
  payload: {
    event: "service_reschedule.proposed",
    slot: { start_date: "2026-07-15", shift: "morning" },
  },
  linked_entity_type: "service_reschedule_request",
  linked_entity_id: "req-1",
  idempotency_key: "k-reschedule",
  delivery_status: "SENT",
  created_at: "2026-07-01T10:00:00.000Z",
  updated_at: "2026-07-01T10:00:00.000Z",
};

describe("DynamicRescheduleProposalCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hydrateMock.mockReturnValue({
      snapshot: null,
      isLoading: false,
    });
  });

  it("shows unlink fallback when message has no request id", () => {
    render(
      <DynamicRescheduleProposalCard
        chatId="chat-1"
        message={{ ...message, linked_entity_id: null }}
        viewerRole="client"
        isOutgoing={false}
      />,
    );

    expect(
      screen.getByText("Não foi possível vincular esta solicitação de reagendamento."),
    ).toBeInTheDocument();
    expect(hydrateMock).toHaveBeenCalledWith("chat-1", null, false);
  });

  it("shows skeleton while reschedule snapshot is loading", () => {
    hydrateMock.mockReturnValue({
      snapshot: null,
      isLoading: true,
    });

    render(
      <DynamicRescheduleProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
      />,
    );

    expect(screen.getByLabelText("Carregando reagendamento")).toBeInTheDocument();
  });

  it("renders active proposal card with client CTAs and emits actions", () => {
    hydrateMock.mockReturnValue({
      snapshot: {
        activeRequest: {
          id: "req-1",
          status: "PROPOSED",
          original_slot: { start_date: "2026-07-10", shift: "afternoon" },
          proposed_slot: { start_date: "2026-07-15", shift: "morning" },
        },
        canProposeReschedule: false,
        canAcceptReschedule: true,
        canRequestAdjustment: true,
        canCancelReschedule: true,
      },
      isLoading: false,
    });

    const onRescheduleAction = vi.fn();

    render(
      <DynamicRescheduleProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
        onRescheduleAction={onRescheduleAction}
      />,
    );

    expect(screen.getByLabelText("Nova data proposta")).toBeInTheDocument();
    expect(screen.getByText("Data proposta")).toBeInTheDocument();
    expect(metricsCountMock).toHaveBeenCalledWith(
      "chats.dynamic_reschedule_card_render",
      1,
      { status: "PROPOSED" },
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirmar nova data" }));
    expect(onRescheduleAction).toHaveBeenCalledWith("accept", "req-1");

    fireEvent.click(screen.getByRole("button", { name: "Pedir ajuste" }));
    expect(onRescheduleAction).toHaveBeenCalledWith("request_adjustment", "req-1");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar solicitação" }));
    expect(onRescheduleAction).toHaveBeenCalledWith("cancel", "req-1");
  });

  it("shows ended copy when snapshot has no active request", () => {
    hydrateMock.mockReturnValue({
      snapshot: {
        activeRequest: null,
        canProposeReschedule: false,
        canAcceptReschedule: false,
        canRequestAdjustment: false,
        canCancelReschedule: false,
      },
      isLoading: false,
    });

    render(
      <DynamicRescheduleProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing
      />,
    );

    expect(screen.getByLabelText("Reagendamento encerrado")).toBeInTheDocument();
    expect(
      screen.getByText("Esta solicitação não está mais ativa."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(metricsCountMock).not.toHaveBeenCalled();
  });

  it("shows provider propose CTA when allowed", () => {
    hydrateMock.mockReturnValue({
      snapshot: {
        activeRequest: {
          id: "req-1",
          status: "REQUESTED",
          original_slot: { start_date: "2026-07-10", shift: "afternoon" },
          proposed_slot: null,
        },
        canProposeReschedule: true,
        canAcceptReschedule: false,
        canRequestAdjustment: false,
        canCancelReschedule: false,
      },
      isLoading: false,
    });

    const onRescheduleAction = vi.fn();

    render(
      <DynamicRescheduleProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="provider"
        isOutgoing
        onRescheduleAction={onRescheduleAction}
      />,
    );

    expect(screen.getByLabelText("Reagendamento solicitado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Propor nova data" }));
    expect(onRescheduleAction).toHaveBeenCalledWith("propose", "req-1");
  });

  it("shows ended date-range slot label from the workflow payload", () => {
    hydrateMock.mockReturnValue({
      snapshot: {
        activeRequest: null,
        canProposeReschedule: false,
        canAcceptReschedule: false,
        canRequestAdjustment: false,
        canCancelReschedule: false,
      },
      isLoading: false,
    });

    render(
      <DynamicRescheduleProposalCard
        chatId="chat-1"
        message={{
          ...message,
          payload: {
            event: "service_reschedule.proposed",
            slot: {
              start_date: "2026-07-15",
              end_date: "2026-07-17",
              shift: "full_day",
            },
          },
        }}
        viewerRole="client"
        isOutgoing={false}
      />,
    );

    expect(screen.getByText("Período proposto")).toBeInTheDocument();
  });

  it("applies outgoing alignment and custom className", () => {
    hydrateMock.mockReturnValue({
      snapshot: {
        activeRequest: {
          id: "req-1",
          status: "PROPOSED",
          original_slot: { start_date: "2026-07-10", shift: "afternoon" },
          proposed_slot: { start_date: "2026-07-15", shift: "morning" },
        },
        canProposeReschedule: false,
        canAcceptReschedule: false,
        canRequestAdjustment: false,
        canCancelReschedule: false,
      },
      isLoading: false,
    });

    const { container } = render(
      <DynamicRescheduleProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing
        className="extra-card"
      />,
    );

    const article = container.querySelector("article");
    expect(article?.className).toContain("ml-auto");
    expect(article?.className).toContain("extra-card");
  });
});
