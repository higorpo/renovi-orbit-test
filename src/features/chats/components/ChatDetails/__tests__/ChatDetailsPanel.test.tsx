// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/features/auth";
import type { ServiceModel } from "@/features/view-services";
import type { ConversationDetailResponse } from "../../types/chats.types";
import { ChatDetailsPanel } from "../ChatDetailsPanel";

vi.mock("@/features/view-services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/view-services")>();
  return {
    ...actual,
    useService: () => ({
      data: {
        id: "sr-1",
        title: "Trocar tomada",
        descriptionPreview: "Tomada queimada",
        listPhase: "negotiation",
        statusTabId: "negotiation",
        createdAt: "2026-06-01T08:00:00Z",
        updatedAt: "2026-06-01T08:00:00Z",
        address: null,
        service: { title: "Eletricista", slug: "eletricista" },
        photoPaths: [],
        proposalCount: 0,
        hasPendingProposal: false,
      } satisfies Partial<ServiceModel> as ServiceModel,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  };
});

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({
    color: "from-blue-500 to-blue-600",
    Icon: () => <span data-testid="service-icon" />,
  }),
}));

vi.mock("@/features/provider-profile/hooks/usePublicProfileImageUrl", () => ({
  usePublicProfileImageUrl: () => ({ url: "", isLoading: false }),
}));

const detail: ConversationDetailResponse = {
  conversation: {
    id: "chat-1",
    service_request_id: "sr-1",
    client_id: "client-1",
    provider_id: "provider-1",
    status: "ACTIVE",
    last_interaction_at: "2026-06-01T12:00:00Z",
    activated_at: "2026-06-01T10:00:00Z",
    inactivated_at: null,
    inactivation_reason: null,
    closed_at: null,
    closure_type: null,
    created_at: "2026-06-01T09:00:00Z",
    updated_at: "2026-06-01T12:00:00Z",
  },
  counterparty: {
    id: "provider-1",
    full_name: "João Prestador",
    profile_image_path: null,
    role: "provider",
  },
  service_request: {
    id: "sr-1",
    title: "Trocar tomada",
  },
  service: {
    id: "service-1",
    title: "Eletricista",
    slug: "eletricista",
    icon_key: null,
    color_key: null,
    image_url: null,
  },
  category: null,
  counterparty_read_receipt: null,
  accepted_proposal: null,
};

const currentUser: Profile = {
  id: "client-1",
  role: "client",
  full_name: "Maria Cliente",
  profile_image_path: null,
};

function renderPanel(props: React.ComponentProps<typeof ChatDetailsPanel>) {
  return render(
    <MemoryRouter>
      <ChatDetailsPanel {...props} />
    </MemoryRouter>,
  );
}

describe("ChatDetailsPanel", () => {
  it("renders accepted proposal section when available", () => {
    const onViewProposalDetails = vi.fn();

    renderPanel({
      detail: {
        ...detail,
        accepted_proposal: {
          id: "prop-accepted",
          proposed_amount: 420,
          selected_slot: { start_date: "2026-07-01", shift: "full_day" },
        },
      },
      currentUser,
      onArchive: vi.fn(),
      onViewProposalDetails,
    });

    expect(screen.getByText("Proposta aceita")).toBeTruthy();
    expect(screen.getByText("R$ 420,00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes da proposta" }));
    expect(onViewProposalDetails).toHaveBeenCalledWith("prop-accepted");
  });

  it("renders service, participants, actions and disclaimer sections", () => {
    const onArchive = vi.fn();

    renderPanel({
      detail,
      currentUser,
      onArchive,
    });

    expect(screen.getByText("Detalhes do serviço")).toBeTruthy();
    expect(screen.getByText("Trocar tomada")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver mais detalhes do serviço" })).toBeTruthy();
    expect(screen.getByText("Participantes")).toBeTruthy();
    expect(screen.getByText("Maria Cliente (você)")).toBeTruthy();
    expect(screen.getByText("João Prestador")).toBeTruthy();
    expect(screen.getByText("Ações da conversa")).toBeTruthy();
    expect(screen.getByText("Coisas para ter em mente")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Encerrar conversa" }));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });
});
