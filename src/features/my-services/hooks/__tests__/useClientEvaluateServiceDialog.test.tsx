// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ServiceModel } from "@/features/view-services";
import { useClientEvaluateServiceDialog } from "../useClientEvaluateServiceDialog";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

function serviceModel(): ServiceModel {
  return {
    id: "sr-1",
    title: "Serviço",
    description: null,
    descriptionPreview: "",
    formData: null,
    formSchema: null,
    listPhase: "in_progress",
    statusTabId: "in_progress",
    contractedServiceId: "cs-1",
    createdAt: "2025-06-01T00:00:00Z",
    updatedAt: "2025-06-01T00:00:00Z",
    requestStatus: "COMPLETED",
    cancelledAt: null,
    completedAt: null,
    address: null,
    service: null,
    photoPaths: [],
    proposalCount: 0,
    hasPendingProposal: false,
    pendingProposalCount: 0,
    activeChatCount: 0,
    unreadChatCount: 0,
    counterpartyName: null,
    counterparty: null,
    contracted: {
      id: "cs-1",
      status: "EXECUTED",
      agreedSlot: null,
      durationUnit: "hours",
      durationValue: 2,
      scheduledStartDate: "2025-06-05",
      scheduledEndDate: null,
      scheduledShift: "full_day",
      provider: null,
      chatId: null,
      updatedAt: null,
    },
    tags: null,
    urgency: null,
    scopeComplexity: null,
    estimatedDurationHint: null,
    missingInfoWarnings: null,
    suggestedEquipment: null,
    suggestedMaterials: null,
    lastActivityAt: null,
    myProposal: null,
    chatSummary: null,
    enrichmentReady: true,
    enrichmentStatus: "READY",
  };
}

describe("useClientEvaluateServiceDialog", () => {
  it("opens and closes with the selected service model", () => {
    const model = serviceModel();
    const { result } = renderHook(() => useClientEvaluateServiceDialog(), { wrapper });

    act(() => result.current.openEvaluateService(model));
    expect(result.current.open).toBe(true);
    expect(result.current.model).toBe(model);

    act(() => result.current.handleOpenChange(false));
    expect(result.current.open).toBe(false);
    expect(result.current.model).toBeNull();
  });

  it("invalidates service queries after completed", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const localWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useClientEvaluateServiceDialog(), {
      wrapper: localWrapper,
    });

    act(() => result.current.openEvaluateService(serviceModel()));
    act(() => result.current.handleCompleted());

    // Sheet owns dismiss after the success step; host only refreshes lists.
    expect(result.current.open).toBe(true);
    expect(result.current.model).not.toBeNull();
    expect(invalidateQueries).toHaveBeenCalled();
  });
});
