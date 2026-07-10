// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useServiceRescheduleMutations } from "../useServiceRescheduleMutations";
import { CHAT_ACTIVE_RESCHEDULE_QUERY_KEY } from "../useActiveChatReschedule";

const requestServiceRescheduleMock = vi.fn();
const proposeServiceRescheduleMock = vi.fn();
const acceptServiceRescheduleMock = vi.fn();
const requestRescheduleAdjustmentMock = vi.fn();
const cancelServiceRescheduleRequestMock = vi.fn();

const { useOnlineStatusMock, generateIdempotencyKeyV7Mock } = vi.hoisted(() => ({
  useOnlineStatusMock: vi.fn(() => true),
  generateIdempotencyKeyV7Mock: vi.fn(() => "idem-generated"),
}));

vi.mock("../../api/serviceReschedule.api", () => ({
  requestServiceReschedule: (...args: unknown[]) => requestServiceRescheduleMock(...args),
  proposeServiceReschedule: (...args: unknown[]) => proposeServiceRescheduleMock(...args),
  acceptServiceReschedule: (...args: unknown[]) => acceptServiceRescheduleMock(...args),
  requestRescheduleAdjustment: (...args: unknown[]) => requestRescheduleAdjustmentMock(...args),
  cancelServiceRescheduleRequest: (...args: unknown[]) =>
    cancelServiceRescheduleRequestMock(...args),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: useOnlineStatusMock,
}));

vi.mock("@/lib/utils/idempotencyKey", () => ({
  generateIdempotencyKeyV7: () => generateIdempotencyKeyV7Mock(),
}));

const mutationData = {
  reschedule_request_id: "req-1",
  chat_id: "chat-1",
  reschedule: {
    contractedServiceId: "cs-1",
    durationUnit: "hours" as const,
    durationValue: 4,
    activeRequest: {
      id: "req-1",
      status: "REQUESTED" as const,
      requested_by_role: "client" as const,
      requested_by_profile_id: "p-1",
      request_note: null,
      original_slot: { start_date: "2030-06-10", shift: "morning" as const },
      original_service_execution_at: "2030-06-10T12:00:00.000Z",
      proposed_slot: null,
      proposed_at: null,
      adjustment_count: 0,
      is_last_minute: false,
      chat_id: "chat-1",
      parent_request_id: null,
    },
    displayStatus: "REQUESTED",
    canClientRequestReschedule: false,
    canProviderRequestReschedule: false,
    canProposeReschedule: false,
    canAcceptReschedule: false,
    canRequestAdjustment: false,
    canCancelReschedule: true,
  },
};

function createWrapper(queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})) {
  return {
    queryClient,
    wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useOnlineStatusMock.mockReturnValue(true);
  generateIdempotencyKeyV7Mock.mockReturnValue("idem-generated");
});

describe("useServiceRescheduleMutations", () => {
  it("blocks mutations when offline", async () => {
    useOnlineStatusMock.mockReturnValue(false);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useServiceRescheduleMutations(), { wrapper });

    await expect(
      result.current.requestReschedule.mutateAsync({ contractedServiceId: "cs-1" }),
    ).rejects.toThrow("OFFLINE");

    expect(requestServiceRescheduleMock).not.toHaveBeenCalled();
  });

  it("requests reschedule, clears idempotency key, and patches caches", async () => {
    requestServiceRescheduleMock.mockResolvedValue({ data: mutationData, error: null });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useServiceRescheduleMutations(), { wrapper });

    await act(async () => {
      await result.current.requestReschedule.mutateAsync({
        contractedServiceId: "cs-1",
        requestNote: "note",
      });
    });

    expect(requestServiceRescheduleMock).toHaveBeenCalledWith({
      contractedServiceId: "cs-1",
      requestNote: "note",
      idempotencyKey: "idem-generated",
    });
    expect(queryClient.getQueryData([CHAT_ACTIVE_RESCHEDULE_QUERY_KEY, "chat-1"])).toEqual(
      mutationData.reschedule,
    );
  });

  it("reuses the same idempotency key across retries until success", async () => {
    requestServiceRescheduleMock
      .mockResolvedValueOnce({
        data: null,
        error: { code: "UNKNOWN", message: "temporary" },
      })
      .mockResolvedValueOnce({ data: mutationData, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useServiceRescheduleMutations(), { wrapper });

    await expect(
      result.current.requestReschedule.mutateAsync({ contractedServiceId: "cs-1" }),
    ).rejects.toThrow("temporary");

    await act(async () => {
      await result.current.requestReschedule.mutateAsync({ contractedServiceId: "cs-1" });
    });

    expect(requestServiceRescheduleMock).toHaveBeenCalledTimes(2);
    expect(requestServiceRescheduleMock.mock.calls[0][0].idempotencyKey).toBe("idem-generated");
    expect(requestServiceRescheduleMock.mock.calls[1][0].idempotencyKey).toBe("idem-generated");
    expect(generateIdempotencyKeyV7Mock).toHaveBeenCalledTimes(1);
  });

  it("propose/accept/adjustment/cancel throw API error messages and succeed otherwise", async () => {
    proposeServiceRescheduleMock.mockResolvedValueOnce({
      data: null,
      error: { code: "INVALID_SLOT_SHAPE", message: "Selecione uma data válida." },
    });
    acceptServiceRescheduleMock.mockResolvedValue({ data: mutationData, error: null });
    requestRescheduleAdjustmentMock.mockResolvedValue({ data: mutationData, error: null });
    cancelServiceRescheduleRequestMock.mockResolvedValue({ data: mutationData, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useServiceRescheduleMutations(), { wrapper });

    await expect(
      result.current.proposeReschedule.mutateAsync({
        rescheduleRequestId: "req-1",
        newSlot: { start_date: "2030-06-20", shift: "morning" },
      }),
    ).rejects.toThrow("Selecione uma data válida.");

    proposeServiceRescheduleMock.mockResolvedValue({ data: mutationData, error: null });

    await act(async () => {
      await result.current.proposeReschedule.mutateAsync({
        rescheduleRequestId: "req-1",
        newSlot: { start_date: "2030-06-20", shift: "morning" },
      });
      await result.current.acceptReschedule.mutateAsync({ rescheduleRequestId: "req-1" });
      await result.current.requestAdjustment.mutateAsync({ rescheduleRequestId: "req-1" });
      await result.current.cancelReschedule.mutateAsync({ rescheduleRequestId: "req-1" });
    });

    await waitFor(() => expect(cancelServiceRescheduleRequestMock).toHaveBeenCalled());
    expect(acceptServiceRescheduleMock).toHaveBeenCalled();
    expect(requestRescheduleAdjustmentMock).toHaveBeenCalled();
  });

  it("uses fallback messages when mutation APIs return empty error payloads", async () => {
    acceptServiceRescheduleMock.mockResolvedValue({ data: null, error: null });
    requestRescheduleAdjustmentMock.mockResolvedValue({ data: null, error: null });
    cancelServiceRescheduleRequestMock.mockResolvedValue({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useServiceRescheduleMutations(), { wrapper });

    await expect(
      result.current.acceptReschedule.mutateAsync({ rescheduleRequestId: "req-1" }),
    ).rejects.toThrow("Não foi possível confirmar o reagendamento.");
    await expect(
      result.current.requestAdjustment.mutateAsync({ rescheduleRequestId: "req-1" }),
    ).rejects.toThrow("Não foi possível pedir ajuste.");
    await expect(
      result.current.cancelReschedule.mutateAsync({ rescheduleRequestId: "req-1" }),
    ).rejects.toThrow("Não foi possível cancelar a solicitação.");
  });
});
