import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CONVERSATION_DETAIL_QUERY_KEY } from "../../constants/queryKeys";
import type { ConversationDetailResponse } from "../../types/chats.types";
import { patchConversationDetailCache } from "../patchConversationDetailCache";

const baseDetail: ConversationDetailResponse = {
  conversation: {
    id: "chat-1",
    service_request_id: "sr-1",
    client_id: "client-1",
    provider_id: "provider-1",
    status: "INACTIVE",
    last_interaction_at: "2026-01-01T10:00:00.000Z",
    activated_at: "2026-01-01T09:00:00.000Z",
    inactivated_at: "2026-01-02T08:00:00.000Z",
    inactivation_reason: "NO_RECIPROCITY",
    closed_at: null,
    closure_type: null,
    created_at: "2026-01-01T09:00:00.000Z",
    updated_at: "2026-01-02T08:00:00.000Z",
  },
  counterparty: {
    id: "provider-1",
    full_name: "Prestador",
    profile_image_path: null,
    role: "provider",
  },
  service_request: {
    id: "sr-1",
    title: "Pintura",
  },
  service: {
    id: "svc-1",
    title: "Pintura",
    slug: "pintura",
    icon_key: null,
    color_key: null,
    image_url: null,
  },
  category: null,
  counterparty_read_receipt: null,
  accepted_proposal: null,
};

describe("patchConversationDetailCache", () => {
  it("reactivates INACTIVE detail to ACTIVE after send", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData([CONVERSATION_DETAIL_QUERY_KEY, "chat-1"], baseDetail);

    const patched = patchConversationDetailCache(queryClient, "chat-1", {
      status: "ACTIVE",
      lastInteractionAt: "2026-01-03T12:00:00.000Z",
    });

    expect(patched).toBe(true);
    const detail = queryClient.getQueryData<ConversationDetailResponse>([
      CONVERSATION_DETAIL_QUERY_KEY,
      "chat-1",
    ]);
    expect(detail?.conversation.status).toBe("ACTIVE");
    expect(detail?.conversation.inactivated_at).toBeNull();
    expect(detail?.conversation.inactivation_reason).toBeNull();
    expect(detail?.conversation.last_interaction_at).toBe("2026-01-03T12:00:00.000Z");
  });

  it("returns false when detail cache is empty", () => {
    const queryClient = new QueryClient();

    expect(
      patchConversationDetailCache(queryClient, "chat-1", {
        status: "ACTIVE",
      }),
    ).toBe(false);
  });

  it("updates only lastInteractionAt when status is omitted", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData([CONVERSATION_DETAIL_QUERY_KEY, "chat-1"], baseDetail);

    const patched = patchConversationDetailCache(queryClient, "chat-1", {
      lastInteractionAt: "2026-01-04T09:00:00.000Z",
    });

    expect(patched).toBe(true);
    const detail = queryClient.getQueryData<ConversationDetailResponse>([
      CONVERSATION_DETAIL_QUERY_KEY,
      "chat-1",
    ]);
    expect(detail?.conversation.status).toBe("INACTIVE");
    expect(detail?.conversation.inactivated_at).toBe("2026-01-02T08:00:00.000Z");
    expect(detail?.conversation.last_interaction_at).toBe("2026-01-04T09:00:00.000Z");
    expect(detail?.conversation.updated_at).toBe("2026-01-04T09:00:00.000Z");
  });

  it("sets non-ACTIVE status without clearing inactivation fields", () => {
    const queryClient = new QueryClient();
    const activeDetail: ConversationDetailResponse = {
      ...baseDetail,
      conversation: {
        ...baseDetail.conversation,
        status: "ACTIVE",
        inactivated_at: null,
        inactivation_reason: null,
      },
    };
    queryClient.setQueryData([CONVERSATION_DETAIL_QUERY_KEY, "chat-1"], activeDetail);

    const patched = patchConversationDetailCache(queryClient, "chat-1", {
      status: "CLOSED",
    });

    expect(patched).toBe(true);
    const detail = queryClient.getQueryData<ConversationDetailResponse>([
      CONVERSATION_DETAIL_QUERY_KEY,
      "chat-1",
    ]);
    expect(detail?.conversation.status).toBe("CLOSED");
    expect(detail?.conversation.inactivated_at).toBeNull();
    expect(detail?.conversation.inactivation_reason).toBeNull();
  });
});
