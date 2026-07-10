// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useCancelService } from "../useCancelService";

const { cancelMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  cancelMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

vi.mock("../../api/services.api", () => ({
  cancelService: cancelMock,
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

describe("useCancelService", () => {
  it("shows success toast when cancel succeeds", async () => {
    cancelMock.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useCancelService(), {
      wrapper: createWrapper(),
    });

    result.current.cancelService("sr-1");

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Serviço cancelado com sucesso.");
    });
  });

  it("shows error toast when cancel fails", async () => {
    cancelMock.mockResolvedValue({ error: "denied" });
    const { result } = renderHook(() => useCancelService(), {
      wrapper: createWrapper(),
    });

    result.current.cancelService("sr-1");

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
  });
});
