import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  acceptServiceReschedule,
  cancelServiceRescheduleRequest,
  proposeServiceReschedule,
  requestRescheduleAdjustment,
  requestServiceReschedule,
} from "../api/serviceReschedule.api";
import type { ServiceRescheduleSlot } from "../types/serviceReschedule.types";

function assertOnline(isOnline: boolean): void {
  if (!isOnline) {
    const error = new Error("OFFLINE");
    throw error;
  }
}

export function useServiceRescheduleMutations() {
  const isOnline = useOnlineStatus();
  const requestKeyRef = useRef<string | null>(null);
  const proposeKeyRef = useRef<string | null>(null);
  const acceptKeyRef = useRef<string | null>(null);
  const adjustmentKeyRef = useRef<string | null>(null);
  const cancelKeyRef = useRef<string | null>(null);

  const requestMutation = useMutation({
    mutationFn: async (params: { contractedServiceId: string; requestNote?: string | null }) => {
      assertOnline(isOnline);
      const idempotencyKey = requestKeyRef.current ?? generateIdempotencyKeyV7();
      requestKeyRef.current = idempotencyKey;

      const result = await requestServiceReschedule({
        ...params,
        idempotencyKey,
      });

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Não foi possível solicitar o reagendamento.");
      }

      requestKeyRef.current = null;
      return result.data;
    },
  });

  const proposeMutation = useMutation({
    mutationFn: async (params: { rescheduleRequestId: string; newSlot: ServiceRescheduleSlot }) => {
      assertOnline(isOnline);
      const idempotencyKey = proposeKeyRef.current ?? generateIdempotencyKeyV7();
      proposeKeyRef.current = idempotencyKey;

      const result = await proposeServiceReschedule({
        ...params,
        idempotencyKey,
      });

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Não foi possível propor a nova data.");
      }

      proposeKeyRef.current = null;
      return result.data;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (params: { rescheduleRequestId: string }) => {
      assertOnline(isOnline);
      const idempotencyKey = acceptKeyRef.current ?? generateIdempotencyKeyV7();
      acceptKeyRef.current = idempotencyKey;

      const result = await acceptServiceReschedule({
        ...params,
        idempotencyKey,
      });

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Não foi possível confirmar o reagendamento.");
      }

      acceptKeyRef.current = null;
      return result.data;
    },
  });

  const adjustmentMutation = useMutation({
    mutationFn: async (params: { rescheduleRequestId: string }) => {
      assertOnline(isOnline);
      const idempotencyKey = adjustmentKeyRef.current ?? generateIdempotencyKeyV7();
      adjustmentKeyRef.current = idempotencyKey;

      const result = await requestRescheduleAdjustment({
        ...params,
        idempotencyKey,
      });

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Não foi possível pedir ajuste.");
      }

      adjustmentKeyRef.current = null;
      return result.data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (params: { rescheduleRequestId: string }) => {
      assertOnline(isOnline);
      const idempotencyKey = cancelKeyRef.current ?? generateIdempotencyKeyV7();
      cancelKeyRef.current = idempotencyKey;

      const result = await cancelServiceRescheduleRequest({
        ...params,
        idempotencyKey,
      });

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Não foi possível cancelar a solicitação.");
      }

      cancelKeyRef.current = null;
      return result.data;
    },
  });

  return {
    requestReschedule: requestMutation,
    proposeReschedule: proposeMutation,
    acceptReschedule: acceptMutation,
    requestAdjustment: adjustmentMutation,
    cancelReschedule: cancelMutation,
  };
}
