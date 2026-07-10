// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChatRescheduleDialogs } from "../useChatRescheduleDialogs";

describe("useChatRescheduleDialogs", () => {
  it("opens the matching dialog for each card CTA", () => {
    const { result } = renderHook(() => useChatRescheduleDialogs("chat-1"));

    act(() => {
      result.current.handleRescheduleAction("propose", "req-1");
    });
    expect(result.current.proposeOpen).toBe(true);
    expect(result.current.activeRequestId).toBe("req-1");

    act(() => {
      result.current.handleRescheduleAction("accept", "req-2");
    });
    expect(result.current.acceptOpen).toBe(true);
    expect(result.current.activeRequestId).toBe("req-2");

    act(() => {
      result.current.handleRescheduleAction("request_adjustment", "req-3");
    });
    expect(result.current.adjustmentOpen).toBe(true);

    act(() => {
      result.current.handleRescheduleAction("cancel", "req-4");
    });
    expect(result.current.cancelOpen).toBe(true);
    expect(result.current.activeRequestId).toBe("req-4");
  });

  it("opens propose/accept helpers with the request id", () => {
    const { result } = renderHook(() => useChatRescheduleDialogs("chat-1"));

    act(() => {
      result.current.openProposeDialog("req-propose");
    });
    expect(result.current.proposeOpen).toBe(true);
    expect(result.current.activeRequestId).toBe("req-propose");

    act(() => {
      result.current.openAcceptDialog("req-accept");
    });
    expect(result.current.acceptOpen).toBe(true);
    expect(result.current.activeRequestId).toBe("req-accept");
  });

  it("resets dialog state when chatId changes", () => {
    const { result, rerender } = renderHook(
      ({ chatId }: { chatId: string | null }) => useChatRescheduleDialogs(chatId),
      { initialProps: { chatId: "chat-1" as string | null } },
    );

    act(() => {
      result.current.setRequestOpen(true);
      result.current.handleRescheduleAction("propose", "req-1");
    });

    expect(result.current.requestOpen).toBe(true);
    expect(result.current.proposeOpen).toBe(true);

    rerender({ chatId: "chat-2" });

    expect(result.current.requestOpen).toBe(false);
    expect(result.current.proposeOpen).toBe(false);
    expect(result.current.acceptOpen).toBe(false);
    expect(result.current.adjustmentOpen).toBe(false);
    expect(result.current.cancelOpen).toBe(false);
    expect(result.current.activeRequestId).toBeNull();
  });
});
