import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { useMobileBackNavigation } from "../useMobileBackNavigation";

const navigateMock = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function wrapper(initialEntry: { pathname: string; state?: unknown }) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        {children}
      </MemoryRouter>
    );
  };
}

describe("useMobileBackNavigation", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("navigates to stackBackPath when present", () => {
    const { result } = renderHook(
      () => useMobileBackNavigation({ backFallback: "/dashboard/services" }),
      {
        wrapper: wrapper({
          pathname: "/dashboard/services/sr-1",
          state: { stackBackPath: "/dashboard/chats/chat-1" },
        }),
      },
    );

    result.current();

    expect(navigateMock).toHaveBeenCalledWith("/dashboard/chats/chat-1");
  });

  it("navigates to returnTo before backFallback for service detail", () => {
    const { result } = renderHook(
      () => useMobileBackNavigation({ backFallback: "/dashboard/services" }),
      {
        wrapper: wrapper({
          pathname: "/dashboard/services/sr-1",
          state: {
            returnTo: "/dashboard/services/calendar",
            background: {
              pathname: "/dashboard/services/calendar",
              search: "",
              hash: "",
              state: { monthIndex: 3 },
              key: "calendar",
            },
          },
        }),
      },
    );

    result.current();

    expect(navigateMock).toHaveBeenCalledWith("/dashboard/services/calendar", {
      state: { monthIndex: 3 },
    });
  });

  it("uses backFallback when no contextual back target exists", () => {
    const { result } = renderHook(
      () => useMobileBackNavigation({ backFallback: "/dashboard/services" }),
      {
        wrapper: wrapper({ pathname: "/dashboard/services/sr-1" }),
      },
    );

    result.current();

    expect(navigateMock).toHaveBeenCalledWith("/dashboard/services");
  });

  it("uses history back when no fallback is configured", () => {
    const { result } = renderHook(
      () => useMobileBackNavigation({}),
      {
        wrapper: wrapper({ pathname: "/dashboard/orphan" }),
      },
    );

    result.current();

    expect(navigateMock).toHaveBeenCalledWith(-1);
  });
});
