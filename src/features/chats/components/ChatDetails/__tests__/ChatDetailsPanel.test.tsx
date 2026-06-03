// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/features/auth";
import type { ConversationDetailResponse } from "../../types/chats.types";
import { ChatDetailsPanel } from "../ChatDetailsPanel";

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({
    color: "from-blue-500 to-blue-600",
    Icon: () => <span data-testid="service-icon" />,
  }),
  useServiceRequestPhotoUrls: () => ({ urls: [], isLoading: false }),
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
    description: "Tomada queimada",
    photos: [],
    urgency: null,
    status: "open",
    scope_complexity: null,
    estimated_duration_hint: null,
    created_at: "2026-06-01T08:00:00Z",
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
  address: {
    neighborhood: "Centro",
    city: "Curitiba",
    state: "PR",
  },
  counterparty_read_receipt: null,
};

const currentUser: Profile = {
  id: "client-1",
  role: "client",
  full_name: "Maria Cliente",
  profile_image_path: null,
};

describe("ChatDetailsPanel", () => {
  it("renders service, participants, actions and disclaimer sections", () => {
    const onArchive = vi.fn();

    render(
      <ChatDetailsPanel
        detail={detail}
        currentUser={currentUser}
        onArchive={onArchive}
      />,
    );

    expect(screen.getByText("Detalhes do serviço")).toBeTruthy();
    expect(screen.getByText("Trocar tomada")).toBeTruthy();
    expect(screen.getByText("Participantes")).toBeTruthy();
    expect(screen.getByText("Maria Cliente (você)")).toBeTruthy();
    expect(screen.getByText("João Prestador")).toBeTruthy();
    expect(screen.getByText("Ações da conversa")).toBeTruthy();
    expect(screen.getByText("Coisas para ter em mente")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Encerrar conversa" }));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });
});
