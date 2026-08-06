// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  profile: { role: "client" as string | null },
  loadingSession: false,
}));

const apiMocks = vi.hoisted(() => ({
  getClientPendingEvaluationPrompt: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  isPendingEvaluationPromptSnoozed: vi.fn(async () => false),
  markPendingEvaluationPromptSnoozed: vi.fn(async () => undefined),
}));

const sequenceMocks = vi.hoisted(() => ({
  waitForProviderLocationPermissionFlow: vi.fn(async () => undefined),
  waitForPushPermissionPromptFlow: vi.fn(async () => undefined),
}));

const trackEvent = vi.fn();

vi.mock("@/features/auth", () => ({
  useAuth: () => authMocks,
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent }),
}));

vi.mock("../../api/pendingEvaluationPrompt.api", () => ({
  getClientPendingEvaluationPrompt: (...args: unknown[]) =>
    apiMocks.getClientPendingEvaluationPrompt(...args),
}));

vi.mock("../../utils/pendingEvaluationPrompt.storage", () => storageMocks);

vi.mock("@/lib/appOpenOverlaySequence", () => sequenceMocks);

import { usePendingEvaluationPrompt } from "../usePendingEvaluationPrompt";

const samplePrompt = {
  serviceRequestId: "sr-1",
  contractedServiceId: "cs-1",
  executedAt: "2026-08-06T12:00:00.000Z",
  title: "Pintura",
  categoryTitle: "Pintura",
  providerFullName: "Ana Silva",
  scheduledStartDate: "2026-08-05",
  scheduledEndDate: "2026-08-06",
  iconKey: "Wind",
  colorKey: "sky_indigo",
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePendingEvaluationPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.user = { id: "user-1" };
    authMocks.profile = { role: "client" };
    authMocks.loadingSession = false;
    sequenceMocks.waitForProviderLocationPermissionFlow.mockResolvedValue(
      undefined,
    );
    sequenceMocks.waitForPushPermissionPromptFlow.mockResolvedValue(undefined);
    storageMocks.isPendingEvaluationPromptSnoozed.mockResolvedValue(false);
    apiMocks.getClientPendingEvaluationPrompt.mockResolvedValue({
      data: samplePrompt,
      error: null,
    });
  });

  it("opens after waiting for location and push flows", async () => {
    let releasePush: (() => void) | undefined;
    sequenceMocks.waitForPushPermissionPromptFlow.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releasePush = resolve;
        }),
    );

    const { result } = renderHook(() => usePendingEvaluationPrompt(), {
      wrapper,
    });

    await waitFor(() =>
      expect(sequenceMocks.waitForPushPermissionPromptFlow).toHaveBeenCalled(),
    );
    expect(result.current.open).toBe(false);

    releasePush?.();

    await waitFor(() => expect(result.current.open).toBe(true), {
      timeout: 3000,
    });
    expect(result.current.serviceRequestId).toBe("sr-1");
    expect(sequenceMocks.waitForProviderLocationPermissionFlow).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      "pending_evaluation_prompt_opened",
      expect.objectContaining({ service_request_id: "sr-1" }),
    );
  });

  it("does not open for provider role", async () => {
    authMocks.profile = { role: "provider" };
    const { result } = renderHook(() => usePendingEvaluationPrompt(), {
      wrapper,
    });

    await new Promise((r) => setTimeout(r, 900));
    expect(result.current.open).toBe(false);
    expect(apiMocks.getClientPendingEvaluationPrompt).not.toHaveBeenCalled();
  });

  it("does not open when there is no pending prompt", async () => {
    apiMocks.getClientPendingEvaluationPrompt.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => usePendingEvaluationPrompt(), {
      wrapper,
    });

    await waitFor(() =>
      expect(apiMocks.getClientPendingEvaluationPrompt).toHaveBeenCalled(),
    );
    await new Promise((r) => setTimeout(r, 900));
    expect(result.current.open).toBe(false);
  });

  it("does not open when the prompt is snoozed", async () => {
    storageMocks.isPendingEvaluationPromptSnoozed.mockResolvedValue(true);

    const { result } = renderHook(() => usePendingEvaluationPrompt(), {
      wrapper,
    });

    await waitFor(() =>
      expect(storageMocks.isPendingEvaluationPromptSnoozed).toHaveBeenCalledWith(
        "sr-1",
      ),
    );
    expect(result.current.open).toBe(false);
  });

  it("dismiss snoozes and closes the prompt", async () => {
    const { result } = renderHook(() => usePendingEvaluationPrompt(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.open).toBe(true), {
      timeout: 3000,
    });

    act(() => {
      result.current.dismiss();
    });

    expect(storageMocks.markPendingEvaluationPromptSnoozed).toHaveBeenCalledWith(
      "sr-1",
    );
    expect(result.current.open).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith(
      "pending_evaluation_prompt_dismissed",
      expect.objectContaining({ service_request_id: "sr-1" }),
    );
  });
});
