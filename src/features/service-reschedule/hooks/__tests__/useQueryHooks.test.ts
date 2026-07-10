// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveChatReschedule } from "../useActiveChatReschedule";
import { useRescheduleRequestDetail } from "../useRescheduleRequestDetail";
import { useRescheduleTimelineHydration } from "../useRescheduleTimelineHydration";

const getActiveServiceRescheduleForChatMock = vi.fn();
const getServiceRescheduleRequestMock = vi.fn();

vi.mock("../../api/serviceReschedule.api", () => ({
  getActiveServiceRescheduleForChat: (...args: unknown[]) =>
    getActiveServiceRescheduleForChatMock(...args),
  getServiceRescheduleRequest: (...args: unknown[]) => getServiceRescheduleRequestMock(...args),
}));

const snapshot = {
  contractedServiceId: "cs-1",
  durationUnit: "hours" as const,
  durationValue: 4,
  activeRequest: null,
  displayStatus: null,
  canClientRequestReschedule: true,
  canProviderRequestReschedule: false,
  canProposeReschedule: false,
  canAcceptReschedule: false,
  canRequestAdjustment: false,
  canCancelReschedule: false,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useActiveChatReschedule", () => {
  it("loads active snapshot for a chat", async () => {
    getActiveServiceRescheduleForChatMock.mockResolvedValue({ data: snapshot, error: null });

    const { result } = renderHook(() => useActiveChatReschedule("chat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getActiveServiceRescheduleForChatMock).toHaveBeenCalledWith("chat-1");
    expect(result.current.snapshot).toEqual(snapshot);
  });

  it("skips fetch when chatId is null or disabled", () => {
    renderHook(() => useActiveChatReschedule(null), { wrapper: createWrapper() });
    renderHook(() => useActiveChatReschedule("chat-1", false), { wrapper: createWrapper() });

    expect(getActiveServiceRescheduleForChatMock).not.toHaveBeenCalled();
  });

  it("surfaces API errors", async () => {
    getActiveServiceRescheduleForChatMock.mockResolvedValue({
      data: null,
      error: { code: "CHAT_NOT_FOUND", message: "Conversa não encontrada para este serviço." },
    });

    const { result } = renderHook(() => useActiveChatReschedule("chat-x"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe("useRescheduleRequestDetail", () => {
  it("loads request snapshot when enabled", async () => {
    getServiceRescheduleRequestMock.mockResolvedValue({ data: snapshot, error: null });

    const { result } = renderHook(() => useRescheduleRequestDetail("req-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
    expect(getServiceRescheduleRequestMock).toHaveBeenCalledWith("req-1");
  });

  it("skips fetch without request id", () => {
    renderHook(() => useRescheduleRequestDetail(null), { wrapper: createWrapper() });
    expect(getServiceRescheduleRequestMock).not.toHaveBeenCalled();
  });

  it("throws when API returns error or empty data", async () => {
    getServiceRescheduleRequestMock.mockResolvedValue({
      data: null,
      error: { code: "UNKNOWN", message: "Erro ao carregar reagendamento" },
    });

    const { result } = renderHook(() => useRescheduleRequestDetail("req-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useRescheduleTimelineHydration", () => {
  it("hydrates timeline snapshot when chat and request ids are present", async () => {
    getServiceRescheduleRequestMock.mockResolvedValue({ data: snapshot, error: null });

    const { result } = renderHook(
      () => useRescheduleTimelineHydration("chat-1", "req-1", true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
    expect(getServiceRescheduleRequestMock).toHaveBeenCalledWith("req-1");
  });

  it("throws when timeline hydration API returns empty data", async () => {
    getServiceRescheduleRequestMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(
      () => useRescheduleTimelineHydration("chat-1", "req-1", true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
