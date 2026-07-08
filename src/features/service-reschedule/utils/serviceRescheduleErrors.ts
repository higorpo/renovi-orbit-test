import type {
  ServiceRescheduleApiError,
  ServiceRescheduleBusinessErrorCode,
} from "../types/serviceReschedule.types";
import { SERVICE_RESCHEDULE_BUSINESS_ERROR_CODES } from "../types/serviceReschedule.types";

const UI_MESSAGES: Record<ServiceRescheduleBusinessErrorCode, string> = {
  CONTRACTED_SERVICE_NOT_FOUND: "Serviço contratado não encontrado.",
  RESCHEDULE_REQUEST_NOT_FOUND: "Solicitação de reagendamento não encontrada.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  INVALID_RESCHEDULE_STATUS: "Esta solicitação não está no estado esperado.",
  RESCHEDULE_NOT_ALLOWED: "Este serviço não pode ser reagendado no momento.",
  CLIENT_RESCHEDULE_WINDOW_CLOSED: "O prazo para reagendar este serviço já passou.",
  PROVIDER_RESCHEDULE_REQUIRES_CONFIRMED:
    "O reagendamento pelo prestador exige um serviço confirmado.",
  ACTIVE_RESCHEDULE_EXISTS: "Já existe uma solicitação de reagendamento em andamento.",
  ADJUSTMENT_LIMIT_REACHED: "O limite de ajustes nesta negociação foi atingido.",
  CHAT_NOT_FOUND: "Conversa não encontrada para este serviço.",
  CHAT_NOT_ACTIVE: "A conversa deste serviço não está ativa.",
  PROPOSED_SLOT_REQUIRED: "É necessário propor uma nova data antes de confirmar.",
  INVALID_SLOT_SHAPE: "Selecione uma data válida.",
  INVALID_SLOT_SHIFT: "Selecione um turno válido.",
  INVALID_SLOT_START_DATE: "Selecione uma data de execução válida.",
  INVALID_SLOT_END_DATE: "A data de término deve ser igual ou posterior à data de início.",
  INVALID_SLOT_DURATION:
    "Informe um tempo estimado válido e um intervalo de datas compatível com essa duração.",
  OFFLINE: "Você está offline. Conecte-se à internet para continuar.",
};

function isBusinessErrorCode(value: string): value is ServiceRescheduleBusinessErrorCode {
  return (SERVICE_RESCHEDULE_BUSINESS_ERROR_CODES as readonly string[]).includes(value);
}

function parseDetailObject(details: string | undefined): Record<string, unknown> | null {
  if (!details) return null;
  try {
    const parsed: unknown = JSON.parse(details);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function extractCode(
  message: string,
  detail: Record<string, unknown> | null,
): ServiceRescheduleBusinessErrorCode | null {
  if (isBusinessErrorCode(message)) return message;

  const detailCode = detail?.code;
  if (typeof detailCode === "string" && isBusinessErrorCode(detailCode)) {
    return detailCode;
  }

  for (const code of SERVICE_RESCHEDULE_BUSINESS_ERROR_CODES) {
    if (message.includes(code)) return code;
  }

  return null;
}

export function mapServiceRescheduleRpcError(error: {
  message: string;
  details?: string;
}): ServiceRescheduleApiError {
  const detail = parseDetailObject(error.details);
  const code = extractCode(error.message, detail) ?? "UNKNOWN";
  const retryRaw = detail?.retry_after_seconds;
  const retryAfterSeconds =
    typeof retryRaw === "number"
      ? retryRaw
      : typeof retryRaw === "string"
        ? Number.parseInt(retryRaw, 10)
        : undefined;

  const message =
    code === "UNKNOWN"
      ? error.message || "Não foi possível concluir o reagendamento."
      : UI_MESSAGES[code];

  return {
    code,
    message,
    ...(Number.isFinite(retryAfterSeconds) ? { retryAfterSeconds } : {}),
  };
}
