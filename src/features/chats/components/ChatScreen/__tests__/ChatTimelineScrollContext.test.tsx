// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ChatTimelineScrollContext,
  useChatTimelineScrollContext,
} from "../ChatTimelineScrollContext";

describe("ChatTimelineScrollContext", () => {
  it("returns null when no provider is present", () => {
    const { result } = renderHook(() => useChatTimelineScrollContext());
    expect(result.current).toBeNull();
  });

  it("returns the provided scroll helpers", () => {
    const value = {
      preserveScrollOnLayoutShift: vi.fn(),
      onComposerFocus: vi.fn(),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChatTimelineScrollContext.Provider value={value}>
        {children}
      </ChatTimelineScrollContext.Provider>
    );

    const { result } = renderHook(() => useChatTimelineScrollContext(), { wrapper });
    expect(result.current).toBe(value);
  });
});
