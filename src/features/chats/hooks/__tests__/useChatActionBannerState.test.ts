// @vitest-environment happy-dom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChatActionBannerState } from "../useChatActionBannerState";

const trackEventMock = vi.fn();

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: trackEventMock }),
}));

describe("useChatActionBannerState", () => {
  it("hides banner after dismiss until chat changes", () => {
    const { result, rerender } = renderHook(
      ({ chatId }) =>
        useChatActionBannerState({
          chatId,
          viewerRole: "client",
          conversationStatus: "ACTIVE",
          pendingProposalId: "p-1",
        }),
      { initialProps: { chatId: "chat-1" as string | null } },
    );

    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.isVisible).toBe(false);

    rerender({ chatId: "chat-2" });
    expect(result.current.isVisible).toBe(true);
  });

  it("tracks impression once per banner variant", () => {
    trackEventMock.mockClear();

    const clientId = "client-1";
    const providerId = "provider-1";

    renderHook(() =>
      useChatActionBannerState({
        chatId: "chat-1",
        viewerRole: "provider",
        conversationStatus: "ACTIVE",
        pendingProposalId: null,
        revisionRequestedProposalId: null,
        clientId,
        providerId,
        messages: [
          {
            id: "m1",
            chat_id: "chat-1",
            sender_user_id: providerId,
            message_type: "TEXT",
            payload: { text: "Olá" },
            linked_entity_type: null,
            linked_entity_id: null,
            idempotency_key: "m1",
            delivery_status: "SENT",
            created_at: "2026-01-01T10:00:00.000Z",
            updated_at: "2026-01-01T10:00:00.000Z",
          },
          {
            id: "m2",
            chat_id: "chat-1",
            sender_user_id: clientId,
            message_type: "TEXT",
            payload: { text: "Oi" },
            linked_entity_type: null,
            linked_entity_id: null,
            idempotency_key: "m2",
            delivery_status: "SENT",
            created_at: "2026-01-01T10:01:00.000Z",
            updated_at: "2026-01-01T10:01:00.000Z",
          },
        ],
      }),
    );

    expect(trackEventMock).toHaveBeenCalledWith(
      "chat_action_banner_impression",
      expect.objectContaining({ action: "send_proposal", chat_id: "chat-1" }),
    );
  });
});
