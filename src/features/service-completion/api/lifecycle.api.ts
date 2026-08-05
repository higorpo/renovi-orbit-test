/**
 * Product writers for EXECUTED / COMPLETED (ADR-0004).
 * Replaces payments `payment_mark_service_executed` / `payment_confirm_service_completed`.
 */

import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { extractRpcErrorCode } from "../utils/rpcErrors";
import type { ServiceRatingScores } from "./ratings.api";

const ERROR_MESSAGES: Record<string, string> = {
  SERVICE_NOT_YET_DUE:
    "Este serviço só pode ser marcado como executado a partir da data agendada.",
  INVALID_STATUS_TRANSITION:
    "Não é possível atualizar o status deste serviço no momento.",
  SERVICE_NOT_FOUND_OR_UNAUTHORIZED:
    "Serviço não encontrado ou você não tem permissão para esta ação.",
  DISPUTE_OPEN:
    "Há uma disputa em aberto. Confirme o recebimento após a resolução.",
  CHECKLIST_PAYLOAD_REQUIRED:
    "Preencha o checklist de conclusão antes de marcar como executado.",
  CHECKLIST_REQUIRED:
    "O checklist de conclusão ainda não está disponível para este serviço.",
  INVALID_CHECKLIST_RESPONSES:
    "Complete todos os critérios do checklist (justificativa e fotos quando necessário).",
  ALREADY_EXECUTED: "Este serviço já foi marcado como executado.",
  DRAFT_VERSION_CONFLICT:
    "O rascunho foi atualizado em outro dispositivo. Recarregue e tente novamente.",
  MISSING_RATING_SCORES: "Informe as quatro notas para confirmar o recebimento.",
  RATING_SCORES_OUT_OF_RANGE: "Cada nota deve ser um inteiro de 1 a 5.",
};

function mapErrorMessage(errorCode: string): string {
  return (
    ERROR_MESSAGES[errorCode] ??
    "Não foi possível concluir a operação. Tente novamente."
  );
}

export type MarkServiceExecutedInput = {
  contractedServiceId: string;
  responses: Record<string, unknown>;
  idempotencyKey: string;
  expectedDraftVersion?: number | null;
};

export type MarkServiceExecutedSuccess = {
  contractedServiceId: string;
  status: string;
  executedAt: string;
  executedLate: boolean;
  evidenceId: string | null;
  idempotent: boolean;
};

export type MarkServiceExecutedResult = {
  data: MarkServiceExecutedSuccess | null;
  error: string | null;
  errorCode?: string;
};

export type ConfirmServiceCompletedInput = {
  contractedServiceId: string;
  scores: ServiceRatingScores;
  idempotencyKey?: string | null;
};

export type ConfirmServiceCompletedSuccess = {
  contractedServiceId: string;
  status: string;
  completedAt: string;
  ratingId: string | null;
  overallScore: number | null;
  idempotent: boolean;
};

export type ConfirmServiceCompletedResult = {
  data: ConfirmServiceCompletedSuccess | null;
  error: string | null;
  errorCode?: string;
};

type MarkExecutedRpcResponse = {
  contracted_service_id?: string;
  status?: string;
  executed_at?: string;
  executed_late?: boolean;
  evidence_id?: string;
  idempotent?: boolean;
};

type ConfirmCompletedRpcResponse = {
  contracted_service_id?: string;
  status?: string;
  completed_at?: string;
  rating_id?: string;
  overall_score?: number;
  idempotent?: boolean;
};

export async function markServiceExecuted(
  input: MarkServiceExecutedInput,
): Promise<MarkServiceExecutedResult> {
  const { contractedServiceId, responses, idempotencyKey, expectedDraftVersion } =
    input;

  if (
    !responses ||
    typeof responses !== "object" ||
    Array.isArray(responses) ||
    Object.keys(responses).length === 0
  ) {
    return {
      data: null,
      error: mapErrorMessage("CHECKLIST_PAYLOAD_REQUIRED"),
      errorCode: "CHECKLIST_PAYLOAD_REQUIRED",
    };
  }

  if (!idempotencyKey?.trim()) {
    return {
      data: null,
      error: "Chave de idempotência obrigatória para marcar como executado.",
      errorCode: "IDEMPOTENCY_KEY_REQUIRED",
    };
  }

  const { data, error } = await supabase.rpc(
    "service_completion_mark_executed" as never,
    {
      p_contracted_service_id: contractedServiceId,
      p_responses: responses,
      p_idempotency_key: idempotencyKey,
      p_expected_draft_version: expectedDraftVersion ?? null,
    } as never,
  );

  if (error) {
    const errorCode = extractRpcErrorCode(error);
    logger.warn("service_completion_mark_executed_failed", {
      feature: "service_completion",
      outcome: "mark_executed",
      contracted_service_id: contractedServiceId,
      errorCode,
      error: error.message,
    });
    return {
      data: null,
      error: mapErrorMessage(errorCode),
      errorCode,
    };
  }

  const payload = data as MarkExecutedRpcResponse;

  return {
    data: {
      contractedServiceId:
        payload.contracted_service_id ?? contractedServiceId,
      status: payload.status ?? "EXECUTED",
      executedAt: payload.executed_at ?? "",
      executedLate: Boolean(payload.executed_late),
      evidenceId: payload.evidence_id ?? null,
      idempotent: Boolean(payload.idempotent),
    },
    error: null,
  };
}

export async function confirmServiceCompleted(
  input: ConfirmServiceCompletedInput,
): Promise<ConfirmServiceCompletedResult> {
  const { contractedServiceId, scores, idempotencyKey } = input;
  const dims = [
    scores.quality,
    scores.punctuality,
    scores.communication,
    scores.value,
  ];
  if (dims.some((s) => !Number.isInteger(s) || s < 1 || s > 5)) {
    return {
      data: null,
      error: mapErrorMessage("RATING_SCORES_OUT_OF_RANGE"),
      errorCode: "RATING_SCORES_OUT_OF_RANGE",
    };
  }

  const { data, error } = await supabase.rpc(
    "service_completion_confirm_with_rating" as never,
    {
      p_contracted_service_id: contractedServiceId,
      p_score_quality: scores.quality,
      p_score_punctuality: scores.punctuality,
      p_score_communication: scores.communication,
      p_score_value: scores.value,
      p_comment: scores.comment?.trim() || null,
      p_idempotency_key: idempotencyKey?.trim() || null,
    } as never,
  );

  if (error) {
    const errorCode = extractRpcErrorCode(error);
    logger.warn("service_completion_confirm_with_rating_failed", {
      feature: "service_completion",
      outcome: "confirm",
      contracted_service_id: contractedServiceId,
      errorCode,
      error: error.message,
    });
    return {
      data: null,
      error: mapErrorMessage(errorCode),
      errorCode,
    };
  }

  const payload = data as ConfirmCompletedRpcResponse;

  return {
    data: {
      contractedServiceId:
        payload.contracted_service_id ?? contractedServiceId,
      status: payload.status ?? "COMPLETED",
      completedAt: payload.completed_at ?? "",
      ratingId: payload.rating_id ?? null,
      overallScore: payload.overall_score ?? null,
      idempotent: Boolean(payload.idempotent),
    },
    error: null,
  };
}

export const lifecycleApi = {
  markServiceExecuted,
  confirmServiceCompleted,
};
