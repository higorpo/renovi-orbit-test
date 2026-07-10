// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useService } from "../useService";

const getServiceByIdMock = vi.fn();

vi.mock("../../api/services.api", () => ({
  getServiceById: (...args: unknown[]) => getServiceByIdMock(...args),
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

describe("useService", () => {
  it("does not fetch when id is blank", () => {
    const { result } = renderHook(() => useService("  "), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(getServiceByIdMock).not.toHaveBeenCalled();
  });

  it("loads service by id", async () => {
    getServiceByIdMock.mockResolvedValue({
      data: { id: "sr-1", title: "Job" },
      error: null,
    });

    const { result } = renderHook(() => useService("sr-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("sr-1");
  });

  it("surfaces API errors", async () => {
    getServiceByIdMock.mockResolvedValue({
      data: null,
      error: "not found",
    });

    const { result } = renderHook(() => useService("sr-missing"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error("not found"));
  });
});
