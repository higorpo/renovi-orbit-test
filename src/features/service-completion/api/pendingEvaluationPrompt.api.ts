/**
 * Lightweight RPC for the client pending-evaluation prompt (EXECUTED + grace).
 */

import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { Json } from "@/lib/supabase/database.types";

export type PendingEvaluationPrompt = {
  serviceRequestId: string;
  contractedServiceId: string;
  executedAt: string;
  title: string;
  categoryTitle: string | null;
  providerFullName: string | null;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
};

/** Lightweight fields shown on the prompt intro step (before context fetch). */
export type PendingEvaluationPromptSummary = Pick<
  PendingEvaluationPrompt,
  | "title"
  | "categoryTitle"
  | "providerFullName"
  | "scheduledStartDate"
  | "scheduledEndDate"
>;

type RpcPendingEvaluationPrompt = {
  service_request_id?: string;
  contracted_service_id?: string;
  executed_at?: string;
  title?: string;
  category_title?: string | null;
  provider_full_name?: string | null;
  scheduled_start_date?: string | null;
  scheduled_end_date?: string | null;
};

export type GetClientPendingEvaluationPromptResult = {
  data: PendingEvaluationPrompt | null;
  error: string | null;
};

function mapPrompt(
  raw: RpcPendingEvaluationPrompt | null | undefined,
): PendingEvaluationPrompt | null {
  if (!raw?.service_request_id || !raw.contracted_service_id) {
    return null;
  }

  return {
    serviceRequestId: raw.service_request_id,
    contractedServiceId: raw.contracted_service_id,
    executedAt: raw.executed_at ?? "",
    title: raw.title ?? "Serviço",
    categoryTitle: raw.category_title ?? null,
    providerFullName: raw.provider_full_name ?? null,
    scheduledStartDate: raw.scheduled_start_date ?? null,
    scheduledEndDate: raw.scheduled_end_date ?? null,
  };
}

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getClientPendingEvaluationPrompt(): Promise<GetClientPendingEvaluationPromptResult> {
  const { data, error } = await supabase.rpc(
    "get_client_pending_evaluation_prompt",
  );

  if (error) {
    logger.warn("get_client_pending_evaluation_prompt_failed", {
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  if (data == null || !isRecord(data)) {
    return { data: null, error: null };
  }

  return {
    data: mapPrompt(data as RpcPendingEvaluationPrompt),
    error: null,
  };
}

export const pendingEvaluationPromptApi = {
  getClientPendingEvaluationPrompt,
};
