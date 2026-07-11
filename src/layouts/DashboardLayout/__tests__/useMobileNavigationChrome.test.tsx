import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useIsMobileTabRoot,
  useMobileNavigationChrome,
} from "../useMobileNavigationChrome";

const useBreakpointMdMock = vi.fn();

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => useBreakpointMdMock(),
}));

function wrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        {children}
      </MemoryRouter>
    );
  };
}

describe("useMobileNavigationChrome", () => {
  beforeEach(() => {
    useBreakpointMdMock.mockReset();
  });

  it("hides mobile chrome on desktop regardless of the route", () => {
    useBreakpointMdMock.mockReturnValue(true);

    const { result } = renderHook(() => useMobileNavigationChrome(), {
      wrapper: wrapper("/dashboard/services/service-1"),
    });

    expect(result.current).toEqual({
      mode: "hidden",
      showTabHeader: false,
      showStackHeader: false,
      showBottomNav: false,
      enableStackTransition: false,
      mainOverflowHidden: false,
      mainPaddingBottom: false,
    });
  });

  it("resolves stack chrome for a mobile detail route", () => {
    useBreakpointMdMock.mockReturnValue(false);

    const { result } = renderHook(() => useMobileNavigationChrome(), {
      wrapper: wrapper("/dashboard/services/service-1"),
    });

    expect(result.current).toMatchObject({
      mode: "stack",
      showStackHeader: true,
      showBottomNav: false,
      stackTitle: "Detalhes do serviço",
      backFallback: "/dashboard/services",
    });
  });
});

describe("useIsMobileTabRoot", () => {
  it("returns true for a mobile dashboard tab root", () => {
    useBreakpointMdMock.mockReturnValue(false);

    const { result } = renderHook(() => useIsMobileTabRoot(), {
      wrapper: wrapper("/dashboard"),
    });

    expect(result.current).toBe(true);
  });

  it("returns false for the same route on desktop", () => {
    useBreakpointMdMock.mockReturnValue(true);

    const { result } = renderHook(() => useIsMobileTabRoot(), {
      wrapper: wrapper("/dashboard"),
    });

    expect(result.current).toBe(false);
  });
});
