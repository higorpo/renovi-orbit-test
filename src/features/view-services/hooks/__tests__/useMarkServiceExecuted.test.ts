// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useMarkServiceExecuted } from "../useMarkServiceExecuted";

const markMock = vi.fn();

vi.mock("../../api/markServiceExecuted.api", () => ({
  markServiceExecuted: (...args: unknown[]) => markMock(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useMarkServiceExecuted", () => {
  it("returns mapped success data", async () => {
    markMock.mockResolvedValue({
      data: {
        serviceId: "cs-1",
        status: "EXECUTED",
        executedAt: "2026-01-01T00:00:00Z",
      },
      error: null,
    });

    const { result } = renderHook(() => useMarkServiceExecuted(), {
      wrapper: createWrapper(),
    });

    const data = await result.current.mutateAsync("cs-1");
    expect(data.status).toBe("EXECUTED");
  });

  it("throws with errorCode when API fails", async () => {
    markMock.mockResolvedValue({
      data: null,
      error: "Não foi possível marcar",
      errorCode: "SERVICE_NOT_CONFIRMED",
    });

    const { result } = renderHook(() => useMarkServiceExecuted(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync("cs-1")).rejects.toMatchObject({
      message: "Não foi possível marcar",
      errorCode: "SERVICE_NOT_CONFIRMED",
    });
  });

  it("throws fallback message when data is missing without error", async () => {
    markMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useMarkServiceExecuted(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync("cs-1")).rejects.toThrow(
      "Falha ao marcar serviço como executado",
    );
  });
});
