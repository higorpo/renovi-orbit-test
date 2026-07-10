// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderCalendarViewMode } from "../useProviderCalendarViewMode";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(),
}));

const useBreakpointMd = vi.mocked(
  await import("@/hooks/useBreakpoint").then((m) => m.useBreakpointMd),
);

describe("useProviderCalendarViewMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses list mode on mobile", () => {
    useBreakpointMd.mockReturnValue(false);
    const { result } = renderHook(() => useProviderCalendarViewMode());
    expect(result.current).toEqual({ viewMode: "list", isDesktop: false });
  });

  it("uses grid mode on desktop", () => {
    useBreakpointMd.mockReturnValue(true);
    const { result } = renderHook(() => useProviderCalendarViewMode());
    expect(result.current).toEqual({ viewMode: "grid", isDesktop: true });
  });
});
