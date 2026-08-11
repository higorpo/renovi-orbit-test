// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useClientServiceJourney } from "../useClientServiceJourney";

const getClientServiceJourneyMock = vi.fn();

vi.mock("../../api/services.api", () => ({
  getClientServiceJourney: (...args: unknown[]) => getClientServiceJourneyMock(...args),
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

describe("useClientServiceJourney", () => {
  it("does not fetch when disabled or blank id", () => {
    const { result } = renderHook(
      () =>
        useClientServiceJourney({
          serviceRequestId: "sr-1",
          enabled: false,
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(false);
    expect(getClientServiceJourneyMock).not.toHaveBeenCalled();
  });

  it("presents milestones from the API", async () => {
    getClientServiceJourneyMock.mockResolvedValue({
      data: {
        milestones: [
          {
            key: "request_created",
            status: "completed",
            occurredAt: "2026-08-10T18:30:00.000Z",
          },
          { key: "payment", status: "current", occurredAt: null },
        ],
      },
      error: null,
    });

    const { result } = renderHook(
      () =>
        useClientServiceJourney({
          serviceRequestId: "sr-1",
          enabled: true,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.milestones).toHaveLength(2));
    expect(result.current.milestones[0]?.label).toBe("Pedido criado");
    expect(result.current.milestones[1]?.label).toBe("Pagamento pendente");
    expect(result.current.milestones[1]?.secondaryText).toBe("Aguardando pagamento");
  });

  it("uses optional rating subtext when ratingOptional is set", async () => {
    getClientServiceJourneyMock.mockResolvedValue({
      data: {
        milestones: [{ key: "rating", status: "current", occurredAt: null }],
      },
      error: null,
    });

    const { result } = renderHook(
      () =>
        useClientServiceJourney({
          serviceRequestId: "sr-1",
          enabled: true,
          ratingOptional: true,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.milestones).toHaveLength(1));
    expect(result.current.milestones[0]?.secondaryText).toBe("Avaliação opcional");
  });
});
