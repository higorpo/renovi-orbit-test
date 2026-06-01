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

    renderHook(() =>
      useChatActionBannerState({
        chatId: "chat-1",
        viewerRole: "provider",
        conversationStatus: "ACTIVE",
        pendingProposalId: null,
        revisionRequestedProposalId: null,
      }),
    );

    expect(trackEventMock).toHaveBeenCalledWith(
      "chat_action_banner_impression",
      expect.objectContaining({ action: "send_proposal", chat_id: "chat-1" }),
    );
  });
});
