// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { useEarningsViewParam } from "../useEarningsViewParam";

function wrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries: [initialEntry] }, children);
  };
}

describe("useEarningsViewParam", () => {
  it("defaults to deposits", () => {
    const { result } = renderHook(() => useEarningsViewParam(), {
      wrapper: wrapper("/dashboard/settings/earnings"),
    });
    expect(result.current.view).toBe("deposits");
  });

  it("reads charges from the query string", () => {
    const { result } = renderHook(() => useEarningsViewParam(), {
      wrapper: wrapper("/dashboard/settings/earnings?view=charges"),
    });
    expect(result.current.view).toBe("charges");
  });

  it("writes charges and clears the param when returning to deposits", () => {
    const { result } = renderHook(() => useEarningsViewParam(), {
      wrapper: wrapper("/dashboard/settings/earnings"),
    });

    act(() => {
      result.current.setView("charges");
    });
    expect(result.current.view).toBe("charges");

    act(() => {
      result.current.setView("deposits");
    });
    expect(result.current.view).toBe("deposits");
  });
});
