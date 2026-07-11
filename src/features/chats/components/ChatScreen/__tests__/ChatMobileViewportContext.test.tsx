// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ChatMobileViewportProvider,
  useChatMobileViewportSchedule,
} from "../ChatMobileViewportContext";

describe("ChatMobileViewportContext", () => {
  it("returns a no-op schedule when provider is missing", () => {
    const { result } = renderHook(() => useChatMobileViewportSchedule());
    expect(() => result.current()).not.toThrow();
  });

  it("exposes the provider scheduleSync callback", () => {
    const scheduleSync = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChatMobileViewportProvider scheduleSync={scheduleSync}>
        {children}
      </ChatMobileViewportProvider>
    );

    const { result } = renderHook(() => useChatMobileViewportSchedule(), { wrapper });
    result.current();
    expect(scheduleSync).toHaveBeenCalledTimes(1);
  });
});
