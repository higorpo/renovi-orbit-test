// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ConversationListItem } from "../../../types/chats.types";
import { ServiceRequestConversationList } from "../ServiceRequestConversationList";

const navigateMock = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({
    Icon: () => <span data-testid="service-icon" />,
    color: "from-slate-500 to-slate-600",
  }),
}));

const useChatConversationsMock = vi.fn();

vi.mock("../../../hooks/useChatConversations", () => ({
  useChatConversations: (...args: unknown[]) => useChatConversationsMock(...args),
}));

const conversation: ConversationListItem = {
  id: "chat-1",
  service_request_id: "sr-1",
  client_id: "client-1",
  provider_id: "provider-1",
  status: "ACTIVE",
  last_interaction_at: "2026-05-30T12:00:00.000Z",
  activated_at: "2026-05-01T12:00:00.000Z",
  inactivated_at: null,
  closed_at: null,
  created_at: "2026-05-01T12:00:00.000Z",
  updated_at: "2026-05-30T12:00:00.000Z",
  counterparty: {
    id: "provider-1",
    full_name: "João Eletricista",
    profile_image_path: null,
    role: "provider",
  },
  service_request_title: "Instalação elétrica",
  service: {
    id: "svc-1",
    title: "Instalação elétrica",
    slug: "instalacao-eletrica",
    icon_key: "Zap",
    color_key: "yellow_orange",
    image_url: null,
  },
  last_message: {
    id: "msg-1",
    message_type: "TEXT",
    created_at: "2026-05-30T12:00:00.000Z",
    preview_text: "Olá, posso visitar amanhã?",
    linked_entity_type: null,
    linked_entity_id: null,
  },
  is_unread: false,
  last_read_at: "2026-05-30T12:00:00.000Z",
};

describe("ServiceRequestConversationList", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useChatConversationsMock.mockReset();
  });

  it("loads conversations filtered by service request id", () => {
    useChatConversationsMock.mockReturnValue({
      conversations: [],
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });

    render(<ServiceRequestConversationList serviceRequestId="sr-1" />);

    expect(useChatConversationsMock).toHaveBeenCalledWith({ serviceRequestId: "sr-1" });
    expect(screen.getByText("Nenhuma conversa ainda")).toBeTruthy();
  });

  it("renders chat rows and navigates to the selected conversation", () => {
    useChatConversationsMock.mockReturnValue({
      conversations: [conversation],
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });

    render(<ServiceRequestConversationList serviceRequestId="sr-1" />);

    expect(screen.getByText("João Eletricista")).toBeTruthy();
    expect(screen.getByText("Olá, posso visitar amanhã?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Conversa com João Eletricista/i }));
    expect(navigateMock).toHaveBeenCalledWith("/dashboard/chats/chat-1");
  });
});
