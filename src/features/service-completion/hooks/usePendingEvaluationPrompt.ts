/**
 * Global client prompt for EXECUTED services still inside the auto-complete grace window.
 * Opens last in the overlay queue (after location + push soft prompt).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  waitForProviderLocationPermissionFlow,
  waitForPushPermissionPromptFlow,
} from "@/lib/appOpenOverlaySequence";
import {
  getClientPendingEvaluationPrompt,
  type PendingEvaluationPrompt,
  type PendingEvaluationPromptSummary,
} from "../api/pendingEvaluationPrompt.api";
import { pendingEvaluationPromptQueryKey } from "./queryKeys";
import {
  isPendingEvaluationPromptSnoozed,
  markPendingEvaluationPromptSnoozed,
} from "../utils/pendingEvaluationPrompt.storage";

const PROMPT_OPEN_DELAY_MS = 600;
/** Brief pause before offering the next pending item after a successful rating. */
const NEXT_PROMPT_DELAY_MS = 800;
const QUERY_STALE_MS = 10 * 60 * 1000;

export type { PendingEvaluationPromptSummary };

export function usePendingEvaluationPrompt() {
  const { user, profile, loadingSession } = useAuth();
  const { trackEvent } = useAnalytics();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activePrompt, setActivePrompt] =
    useState<PendingEvaluationPrompt | null>(null);
  const openedForIdRef = useRef<string | null>(null);
  const evaluatingRef = useRef(false);
  const openRef = useRef(false);
  /** Blocks effect-driven re-open briefly after a successful rating. */
  const suppressOpenUntilRef = useRef(0);

  const isClient = profile?.role === "client";
  const userId = user?.id;
  const enabled = Boolean(userId) && isClient && !loadingSession;

  const query = useQuery({
    queryKey: pendingEvaluationPromptQueryKey(userId ?? ""),
    enabled,
    staleTime: QUERY_STALE_MS,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await getClientPendingEvaluationPrompt();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const tryOpenPrompt = useCallback(
    async (prompt: PendingEvaluationPrompt) => {
      if (await isPendingEvaluationPromptSnoozed(prompt.serviceRequestId)) {
        setOpen(false);
        setActivePrompt(null);
        return;
      }

      setActivePrompt(prompt);
      setOpen(true);
      openedForIdRef.current = prompt.serviceRequestId;
      trackEvent("pending_evaluation_prompt_opened", {
        service_request_id: prompt.serviceRequestId,
      });
    },
    [trackEvent],
  );

  const evaluatePrompt = useCallback(
    async (promptOverride?: PendingEvaluationPrompt | null) => {
      if (!enabled || evaluatingRef.current) return;
      if (
        promptOverride === undefined &&
        Date.now() < suppressOpenUntilRef.current
      ) {
        return;
      }
      evaluatingRef.current = true;

      try {
        await waitForProviderLocationPermissionFlow();
        await waitForPushPermissionPromptFlow();

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, PROMPT_OPEN_DELAY_MS);
        });

        const prompt =
          promptOverride !== undefined ? promptOverride : (query.data ?? null);
        if (!prompt) {
          setOpen(false);
          setActivePrompt(null);
          return;
        }

        if (
          openedForIdRef.current === prompt.serviceRequestId &&
          openRef.current
        ) {
          return;
        }

        await tryOpenPrompt(prompt);
      } finally {
        evaluatingRef.current = false;
      }
    },
    [enabled, query.data, tryOpenPrompt],
  );

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      setActivePrompt(null);
      openedForIdRef.current = null;
      return;
    }

    if (query.isLoading || query.isError) return;

    void evaluatePrompt();
  }, [enabled, evaluatePrompt, query.data, query.isError, query.isLoading]);

  const dismiss = useCallback(() => {
    const serviceRequestId =
      activePrompt?.serviceRequestId ?? openedForIdRef.current;
    if (serviceRequestId) {
      void markPendingEvaluationPromptSnoozed(serviceRequestId);
      trackEvent("pending_evaluation_prompt_dismissed", {
        service_request_id: serviceRequestId,
      });
    }
    setOpen(false);
    setActivePrompt(null);
  }, [activePrompt?.serviceRequestId, trackEvent]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setOpen(true);
        return;
      }
      if (openRef.current && activePrompt) {
        dismiss();
        return;
      }
      setOpen(false);
    },
    [activePrompt, dismiss],
  );

  const handleCompleted = useCallback(async () => {
    const completedId = activePrompt?.serviceRequestId;
    if (completedId) {
      trackEvent("pending_evaluation_prompt_completed", {
        service_request_id: completedId,
      });
    }

    setOpen(false);
    setActivePrompt(null);
    openedForIdRef.current = null;
    suppressOpenUntilRef.current = Date.now() + NEXT_PROMPT_DELAY_MS;

    if (!userId) return;

    await queryClient.invalidateQueries({
      queryKey: pendingEvaluationPromptQueryKey(userId),
    });

    window.setTimeout(() => {
      void (async () => {
        try {
          const result = await queryClient.fetchQuery({
            queryKey: pendingEvaluationPromptQueryKey(userId),
            queryFn: async () => {
              const res = await getClientPendingEvaluationPrompt();
              if (res.error) throw new Error(res.error);
              return res.data;
            },
            staleTime: QUERY_STALE_MS,
          });

          if (!result) return;
          await evaluatePrompt(result);
        } catch {
          // Query/error surfaces via react-query; skip auto-open on failure.
        }
      })();
    }, NEXT_PROMPT_DELAY_MS);
  }, [
    activePrompt?.serviceRequestId,
    evaluatePrompt,
    queryClient,
    trackEvent,
    userId,
  ]);

  const promptSummary: PendingEvaluationPromptSummary | null = activePrompt
    ? {
        title: activePrompt.title,
        categoryTitle: activePrompt.categoryTitle,
        providerFullName: activePrompt.providerFullName,
        scheduledStartDate: activePrompt.scheduledStartDate,
        scheduledEndDate: activePrompt.scheduledEndDate,
        iconKey: activePrompt.iconKey,
        colorKey: activePrompt.colorKey,
      }
    : null;

  return {
    open,
    serviceRequestId: activePrompt?.serviceRequestId ?? null,
    promptSummary,
    setOpen: handleOpenChange,
    dismiss,
    onCompleted: () => {
      void handleCompleted();
    },
  };
}
