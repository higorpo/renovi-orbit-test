import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientMyServicesCancel } from "../useClientMyServicesCancel";
import * as serviceRequestsApi from "../../api/serviceRequests.api";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "client-1" } })),
}));

vi.mock("../../api/serviceRequests.api", () => ({
  cancelServiceRequest: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const cancelServiceRequest = vi.mocked(serviceRequestsApi.cancelServiceRequest);
const { toast } = await import("sonner");

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useClientMyServicesCancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates list and shows success toast on cancel success", async () => {
    cancelServiceRequest.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useClientMyServicesCancel(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.cancelServiceRequest("sr-1");
    });

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Serviço cancelado com sucesso."));
    expect(cancelServiceRequest).toHaveBeenCalledWith({ id: "sr-1", clientId: "client-1" });
  });

  it("shows error toast when mutation rejects", async () => {
    cancelServiceRequest.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useClientMyServicesCancel(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.cancelServiceRequest("sr-1");
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível cancelar o serviço. Tente novamente.")
    );
  });

  it("sets isCancelling while mutation is pending", async () => {
    let resolveCancel!: (v: { error: string | null }) => void;
    cancelServiceRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCancel = resolve;
        })
    );

    const { result } = renderHook(() => useClientMyServicesCancel(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.cancelServiceRequest("sr-1");
    });

    await waitFor(() => expect(result.current.isCancelling).toBe(true));

    await act(async () => {
      resolveCancel({ error: null });
    });

    await waitFor(() => expect(result.current.isCancelling).toBe(false));
  });
});
