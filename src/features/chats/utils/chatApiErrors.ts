import type { ChatsApiError, CnsBusinessErrorCode } from "../types/chats.types";
import { CNS_BUSINESS_ERROR_CODES } from "../types/chats.types";

const UI_MESSAGES: Record<CnsBusinessErrorCode, string> = {
  FREE_MESSAGING_DISABLED_PROPOSAL_PENDING:
    "Envie ou responda à proposta antes de continuar a conversa.",
  NO_ACTIVE_SLOT: "Limite de conversas ativas atingido para este pedido.",
  SR_NOT_OPEN: "Este pedido não está mais aberto para negociação.",
  CONVERSATION_CLOSED: "Esta conversa foi encerrada.",
  CONVERSATION_NOT_FOUND: "Conversa não encontrada.",
  NOT_A_PARTICIPANT: "Você não participa desta conversa.",
  INVALID_MESSAGE_ID: "Mensagem inválida para marcar como lida.",
  RATE_LIMITED: "Muitas mensagens em pouco tempo. Aguarde um instante.",
  REVISION_LIMIT_EXCEEDED: "Limite de revisões de proposta atingido.",
  PROPOSAL_EXPIRED: "Esta proposta expirou.",
};

function isBusinessErrorCode(value: string): value is CnsBusinessErrorCode {
  return (CNS_BUSINESS_ERROR_CODES as readonly string[]).includes(value);
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
): CnsBusinessErrorCode | null {
  if (isBusinessErrorCode(message)) return message;

  const detailCode = detail?.code;
  if (typeof detailCode === "string" && isBusinessErrorCode(detailCode)) {
    return detailCode;
  }

  for (const code of CNS_BUSINESS_ERROR_CODES) {
    if (message.includes(code)) return code;
  }

  return null;
}

export function mapCnsRpcError(error: { message: string; details?: string }): ChatsApiError {
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
      ? error.message || "Não foi possível concluir a operação."
      : UI_MESSAGES[code];

  return {
    code,
    message,
    ...(Number.isFinite(retryAfterSeconds) ? { retryAfterSeconds } : {}),
  };
}
