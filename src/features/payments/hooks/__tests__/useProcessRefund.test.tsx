// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as refundApi from "../../api/refund.api";
import { useProcessRefund } from "../useProcessRefund";

vi.mock("@/features/chats", () => ({
  CHAT_CONVERSATIONS_LIST_QUERY_KEY: "chat-conversations",
  CONVERSATION_DETAIL_QUERY_KEY: "conversation-detail",
}));

function createWrapper(queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})) {
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe("useProcessRefund", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns refund success and invalidates related queries", async () => {
    vi.spyOn(refundApi, "processContractedServiceRefund").mockResolvedValue({
      data: {
        scheduleId: "sched-1",
        outcome: "PRE_CHARGE_CANCELLED",
      },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useProcessRefund(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ contractedServiceId: "service-1" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.outcome).toBe("PRE_CHARGE_CANCELLED");
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("throws with errorCode when refund fails", async () => {
    vi.spyOn(refundApi, "processContractedServiceRefund").mockResolvedValue({
      data: null,
      error: "Não é possível cancelar",
      errorCode: "SERVICE_NOT_CANCELLABLE",
      status: 409,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProcessRefund(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ contractedServiceId: "service-1" });
      }),
    ).rejects.toMatchObject({
      message: "Não é possível cancelar",
      errorCode: "SERVICE_NOT_CANCELLABLE",
      status: 409,
    });
  });

  it("passes cancellation reason and throws fallback on empty failure", async () => {
    const spy = vi.spyOn(refundApi, "processContractedServiceRefund").mockResolvedValue({
      data: null,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProcessRefund(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          contractedServiceId: "service-1",
          cancellationReason: "Cliente desistiu",
        });
      }),
    ).rejects.toThrow(
      "Não foi possível processar o cancelamento/reembolso. Tente novamente.",
    );

    expect(spy).toHaveBeenCalledWith({
      contractedServiceId: "service-1",
      cancellationReason: "Cliente desistiu",
    });
  });
});
