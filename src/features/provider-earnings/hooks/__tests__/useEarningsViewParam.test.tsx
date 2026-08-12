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
  it("defaults to deposits and the current month", () => {
    const { result } = renderHook(() => useEarningsViewParam(), {
      wrapper: wrapper("/dashboard/settings/earnings"),
    });
    expect(result.current.view).toBe("deposits");
    expect(result.current.period).toBe("month");
  });

  it("reads charges from the query string", () => {
    const { result } = renderHook(() => useEarningsViewParam(), {
      wrapper: wrapper("/dashboard/settings/earnings?view=charges"),
    });
    expect(result.current.view).toBe("charges");
  });

  it("writes charges and period without dropping the other param", () => {
    const { result } = renderHook(() => useEarningsViewParam(), {
      wrapper: wrapper("/dashboard/settings/earnings"),
    });

    act(() => {
      result.current.setView("charges");
    });
    expect(result.current.view).toBe("charges");
    expect(result.current.period).toBe("month");

    act(() => {
      result.current.setPeriod("3m");
    });
    expect(result.current.view).toBe("charges");
    expect(result.current.period).toBe("3m");

    act(() => {
      result.current.setView("deposits");
    });
    expect(result.current.view).toBe("deposits");
    expect(result.current.period).toBe("3m");
  });

  it("reads period from the query string", () => {
    const { result } = renderHook(() => useEarningsViewParam(), {
      wrapper: wrapper("/dashboard/settings/earnings?view=charges&period=6m"),
    });
    expect(result.current.view).toBe("charges");
    expect(result.current.period).toBe("6m");
  });
});
