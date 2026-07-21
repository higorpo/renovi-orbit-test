import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { parsePaymentRpcDetailObject } from "../utils/paymentApiErrors";

const SERVICE_COMPLETION_ERROR_MESSAGES: Record<string, string> = {
  SERVICE_NOT_YET_DUE:
    "Este serviço só pode ser marcado como executado a partir da data agendada.",
  INVALID_STATUS_TRANSITION:
    "Não é possível atualizar o status deste serviço no momento.",
  SERVICE_NOT_FOUND_OR_UNAUTHORIZED:
    "Serviço não encontrado ou você não tem permissão para esta ação.",
  DISPUTE_OPEN:
    "Há uma disputa em aberto. Confirme o recebimento após a resolução.",
};

function mapServiceCompletionErrorMessage(errorCode: string): string {
  return (
    SERVICE_COMPLETION_ERROR_MESSAGES[errorCode] ??
    "Não foi possível concluir a operação. Tente novamente."
  );
}

function extractRpcErrorCode(error: {
  message: string;
  details?: string;
}): string {
  const detail = parsePaymentRpcDetailObject(error.details);
  if (typeof detail?.code === "string") {
    return detail.code;
  }
  return error.message;
}

export type MarkServiceExecutedSuccess = {
  serviceId: string;
  status: string;
  executedAt: string;
};

export type MarkServiceExecutedResult = {
  data: MarkServiceExecutedSuccess | null;
  error: string | null;
  errorCode?: string;
};

export type ConfirmServiceCompletedSuccess = {
  serviceId: string;
  status: string;
  completedAt: string;
};

export type ConfirmServiceCompletedResult = {
  data: ConfirmServiceCompletedSuccess | null;
  error: string | null;
  errorCode?: string;
};

type MarkExecutedRpcResponse = {
  service_id: string;
  status: string;
  executed_at: string;
};

type ConfirmCompletedRpcResponse = {
  service_id: string;
  status: string;
  completed_at: string;
};

/** CHK-040: payments owns payment_mark_service_executed. */
export async function markServiceExecuted(
  contractedServiceId: string,
): Promise<MarkServiceExecutedResult> {
  const { data, error } = await supabase.rpc("payment_mark_service_executed", {
    p_service_id: contractedServiceId,
  });

  if (error) {
    const errorCode = extractRpcErrorCode(error);
    logger.warn("payment_mark_service_executed_failed", {
      contractedServiceId,
      errorCode,
      error: error.message,
    });
    return {
      data: null,
      error: mapServiceCompletionErrorMessage(errorCode),
      errorCode,
    };
  }

  const payload = data as MarkExecutedRpcResponse;

  return {
    data: {
      serviceId: payload.service_id,
      status: payload.status,
      executedAt: payload.executed_at,
    },
    error: null,
  };
}

/** CHK-040: payments owns payment_confirm_service_completed. */
export async function confirmServiceCompleted(
  contractedServiceId: string,
): Promise<ConfirmServiceCompletedResult> {
  const { data, error } = await supabase.rpc("payment_confirm_service_completed", {
    p_service_id: contractedServiceId,
  });

  if (error) {
    const errorCode = extractRpcErrorCode(error);
    logger.warn("payment_confirm_service_completed_failed", {
      contractedServiceId,
      errorCode,
      error: error.message,
    });
    return {
      data: null,
      error: mapServiceCompletionErrorMessage(errorCode),
      errorCode,
    };
  }

  const payload = data as ConfirmCompletedRpcResponse;

  return {
    data: {
      serviceId: payload.service_id,
      status: payload.status,
      completedAt: payload.completed_at,
    },
    error: null,
  };
}
