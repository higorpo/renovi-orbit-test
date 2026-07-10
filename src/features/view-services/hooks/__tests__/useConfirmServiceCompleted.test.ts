// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useConfirmServiceCompleted } from "../useConfirmServiceCompleted";

const confirmMock = vi.fn();

vi.mock("../../api/confirmServiceCompleted.api", () => ({
  confirmServiceCompleted: (...args: unknown[]) => confirmMock(...args),
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

describe("useConfirmServiceCompleted", () => {
  it("returns mapped success data", async () => {
    confirmMock.mockResolvedValue({
      data: {
        serviceId: "cs-1",
        status: "COMPLETED",
        completedAt: "2026-01-01T00:00:00Z",
      },
      error: null,
    });

    const { result } = renderHook(() => useConfirmServiceCompleted(), {
      wrapper: createWrapper(),
    });

    const data = await result.current.mutateAsync("cs-1");
    expect(data.serviceId).toBe("cs-1");
  });

  it("throws with errorCode when API fails", async () => {
    confirmMock.mockResolvedValue({
      data: null,
      error: "Não foi possível confirmar",
      errorCode: "SERVICE_NOT_EXECUTED",
    });

    const { result } = renderHook(() => useConfirmServiceCompleted(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync("cs-1")).rejects.toMatchObject({
      message: "Não foi possível confirmar",
      errorCode: "SERVICE_NOT_EXECUTED",
    });
  });

  it("throws fallback message when data is missing without error", async () => {
    confirmMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useConfirmServiceCompleted(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync("cs-1")).rejects.toThrow(
      "Falha ao confirmar recebimento",
    );
  });
});
