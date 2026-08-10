// @vitest-environment happy-dom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/features/auth";
import type { ConversationDetailResponse } from "../../../types/chats.types";
import { ChatDetailsMobileSheet } from "../ChatDetailsMobileSheet";

vi.mock("../ChatDetailsPanel", () => ({
  ChatDetailsPanel: () => <div data-testid="chat-details-panel" />,
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

describe("ChatDetailsMobileSheet", () => {
  it("renders a bottom sheet with scrollable details content", () => {
    render(
      <ChatDetailsMobileSheet
        open
        onOpenChange={vi.fn()}
        detail={detail}
        currentUser={currentUser}
        onArchive={vi.fn()}
      />,
    );

    const sheet = screen.getByTestId("chat-details-mobile-sheet");
    expect(sheet.className).toContain("max-h-[90vh]");
    expect(sheet.className).toContain("rounded-t-2xl");
    expect(screen.getByText("Mais informações")).toBeTruthy();
    expect(screen.getByTestId("chat-details-panel")).toBeTruthy();
  });
});
