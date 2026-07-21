const DEFAULT_PAYMENT_USER_MESSAGE =
  "Não foi possível concluir a operação. Tente novamente.";

/** Known payment/card error codes → friendly PT-BR copy. Never surface raw backend text. */
const PAYMENT_USER_MESSAGES: Record<string, string> = {
  // Card / tokenization
  REJECTED: "Seu cartão foi recusado. Tente outro cartão ou entre em contato com o emissor.",
  CARD_DECLINED: "Seu cartão foi recusado. Tente outro cartão ou entre em contato com o emissor.",
  INVALID_CARD: "Não foi possível validar este cartão. Confira os dados e tente novamente.",
  CARD_NOT_FOUND: "Não encontramos este cartão. Adicione o cartão novamente e tente de novo.",
  INSUFFICIENT_FUNDS: "Saldo insuficiente no cartão. Tente outro cartão.",
  CPF_INVALID: "O CPF informado é inválido. Confira e tente novamente.",
  CPF_REQUIRED: "Informe seu CPF para continuar.",
  PHONE_REQUIRED: "Informe seu telefone para continuar.",
  PHONE_INVALID: "O telefone informado é inválido. Confira e tente novamente.",
  EMAIL_REQUIRED: "Seu e-mail é necessário para salvar o cartão. Atualize o perfil e tente novamente.",
  BILLING_ADDRESS_REQUIRED: "Informe o endereço de cobrança completo para continuar.",
  BILLING_ADDRESS_MISSING: "Informe o endereço de cobrança completo para continuar.",
  PAYMENT_PROFILE_REJECTED:
    "Não foi possível cadastrar este cartão. Verifique os dados ou tente outro cartão.",
  PAYMENT_PROFILE_INACTIVE:
    "Não foi possível cadastrar este cartão. Verifique os dados ou tente outro cartão.",
  failed_to_persist_payment_token:
    "Não foi possível salvar o cartão no momento. Tente novamente em instantes.",
  provider_not_credentialed:
    "O prestador ainda não está apto a receber pagamentos. Tente novamente mais tarde.",
  PROVIDER_NOT_CREDENTIALED:
    "O prestador ainda não está apto a receber pagamentos. Tente novamente mais tarde.",
  PROFILE_INCOMPLETE: "Complete seu CPF e telefone no checkout antes de confirmar.",
  method_not_allowed: "Não foi possível concluir a operação. Tente novamente.",
  forbidden: "Você não tem permissão para esta ação.",
  Unauthorized: "Sua sessão expirou. Entre novamente para continuar.",

  // Manual charge / schedule
  RATE_LIMIT_EXCEEDED: "Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.",
  PAYMENT_ALREADY_IN_PROGRESS: "Já existe um pagamento em andamento. Aguarde e tente novamente.",
  CLEARSALE_SESSION_REQUIRED: "Aguarde a inicialização da verificação de segurança.",
  CLEARSALE_SESSION_INVALID: "Não foi possível validar a verificação de segurança. Tente novamente.",
  CLEARSALE_SESSION_STALE: "A verificação de segurança expirou. Atualize a tela e tente novamente.",
  CLEARSALE_SESSION_USED: "A verificação de segurança já foi utilizada. Atualize a tela e tente novamente.",
  CLEARSALE_SESSION_EXPIRED: "A verificação de segurança expirou. Atualize a tela e tente novamente.",
  PAYMENT_TOKEN_MISSING: "Nenhum cartão vinculado a este pagamento. Adicione um cartão e tente novamente.",
  PAYMENT_TOKEN_INACTIVE:
    "Este cartão não está mais disponível. Selecione ou adicione outro cartão.",
  PAYMENT_TOKEN_COMPANY_MISMATCH:
    "Este cartão não está vinculado à empresa de pagamento da Renovi. Adicione o cartão novamente.",
  CHARGE_AMOUNT_CALCULATION_FAILED:
    "Não foi possível calcular o valor do pagamento. Tente novamente.",
  COMMIT_FAILED: "Não foi possível concluir o pagamento. Tente novamente em instantes.",
  INVALID_SCHEDULE_STATE:
    "Não é possível pagar neste momento. Atualize a página e tente novamente.",
  SCHEDULE_NOT_FOUND: "Não encontramos este pagamento. Atualize a página e tente novamente.",
  SERVICE_CANCELLED: "Este serviço foi cancelado e não pode mais ser pago.",
  SERVICE_AUTO_CANCELLED: "Este serviço foi cancelado automaticamente por falta de pagamento.",
  TERMINAL: "Não foi possível concluir o pagamento com este cartão. Tente outro cartão.",
  RETRYABLE: "Não foi possível concluir o pagamento. Tente novamente em instantes.",
  // FIX-007 coarse client buckets (Edge returns these; fine codes stay in DB/logs)
  CARD_REJECTED:
    "Não foi possível cadastrar este cartão. Verifique os dados ou tente outro cartão.",
  RISK_REJECTED:
    "Seu pagamento foi recusado pela análise de segurança. Tente outro cartão ou fale com o suporte.",

  // ClearSale / NetCred risk analysis (rejectedReason → stable codes)
  RISK_ANALYSIS_NO_CONTACT:
    "Não foi possível validar seu pagamento na análise de segurança. Confira seus dados de contato e tente novamente, ou use outro cartão.",
  RISK_ANALYSIS_FRAUD_SUSPICION:
    "Seu pagamento foi recusado pela análise de segurança. Tente outro cartão ou fale com o suporte.",
  RISK_ANALYSIS_CANCELLED_DUPLICATE:
    "Este pagamento foi cancelado por duplicidade ou solicitação. Se ainda precisar, tente novamente com outro cartão.",
  RISK_ANALYSIS_CONFIRMED_FRAUD:
    "Seu pagamento foi recusado pela análise de segurança. Use outro cartão ou fale com o suporte.",
  RISK_ANALYSIS_BUSINESS_RULE:
    "Seu pagamento foi recusado pelas regras de segurança. Tente outro cartão.",
  RISK_ANALYSIS_POLICY:
    "Seu pagamento foi recusado pela política de segurança. Tente outro cartão ou fale com o suporte.",
  RISK_ANALYSIS_MANUAL_FACILITATOR:
    "Seu pagamento foi recusado na análise de segurança. Tente outro cartão ou fale com o suporte.",
  RISK_ANALYSIS_REJECTED:
    "Seu pagamento foi recusado pela análise de segurança. Tente outro cartão ou fale com o suporte.",

  // Update payment method / installments
  INSTALLMENT_HMAC_REQUIRED: "Selecione novamente as parcelas antes de continuar.",
  INSTALLMENT_HMAC_PAYLOAD_INVALID: "Selecione novamente as parcelas antes de continuar.",
  INSTALLMENT_SIGNATURE_EXPIRED: "As opções de parcelamento expiraram. Selecione novamente.",
  INVALID_INSTALLMENT_SIGNATURE: "As opções de parcelamento são inválidas. Selecione novamente.",
  INSTALLMENT_HMAC_PROPOSAL_MISMATCH: "As opções de parcelamento são inválidas. Selecione novamente.",
  INSTALLMENT_HMAC_SERVICE_MISMATCH: "As opções de parcelamento são inválidas. Selecione novamente.",
  INSTALLMENT_HMAC_BASE_AMOUNT_MISMATCH:
    "As opções de parcelamento são inválidas. Selecione novamente.",
  INSTALLMENT_HMAC_BRAND_MISMATCH:
    "A bandeira do cartão mudou. Selecione novamente as parcelas.",
  INSTALLMENT_HMAC_INSTALLMENT_MISMATCH:
    "As opções de parcelamento são inválidas. Selecione novamente.",
  INSTALLMENT_HMAC_FEE_AMOUNT_MISMATCH:
    "As opções de parcelamento são inválidas. Selecione novamente.",

  // Card revoke / tokens
  CARD_TOKEN_LINKED_TO_ACTIVE_SCHEDULE:
    "Este cartão está vinculado a pagamentos pendentes. Atribua outro cartão ao serviço antes de removê-lo.",
  CLIENT_CARD_TOKEN_NOT_FOUND: "Este cartão não foi encontrado ou já foi removido.",

  // Generic API
  INVALID_RESPONSE: "Resposta inesperada do servidor. Tente novamente.",
  INVALID_REQUEST: "Não foi possível concluir a operação. Verifique os dados e tente novamente.",
  OFFLINE: "Você está offline. Conecte-se à internet para continuar.",
};

const KNOWN_FRIENDLY_MESSAGES = new Set(Object.values(PAYMENT_USER_MESSAGES));

export type MapPaymentUserMessageOptions = {
  fallback?: string;
};

function looksLikeErrorCode(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(value);
}

/**
 * Maps a payment/card error code (or unknown backend string) to a user-facing PT-BR message.
 * Never returns raw backend text for unknown values.
 */
export function mapPaymentUserMessage(
  codeOrMessage: string | null | undefined,
  options?: MapPaymentUserMessageOptions,
): string {
  const fallback = options?.fallback ?? DEFAULT_PAYMENT_USER_MESSAGE;
  if (!codeOrMessage?.trim()) {
    return fallback;
  }

  const key = codeOrMessage.trim();
  if (PAYMENT_USER_MESSAGES[key]) {
    return PAYMENT_USER_MESSAGES[key];
  }

  const upper = key.toUpperCase();
  if (PAYMENT_USER_MESSAGES[upper]) {
    return PAYMENT_USER_MESSAGES[upper];
  }

  // Already mapped by the API layer — keep our own friendly copy.
  if (KNOWN_FRIENDLY_MESSAGES.has(key) || key === fallback) {
    return key;
  }

  return fallback;
}

/**
 * Resolves a thrown error or API failure into a friendly PT-BR message.
 * Prefers `errorCode` when present; never surfaces raw backend messages.
 */
export function mapPaymentErrorToUserMessage(
  error: unknown,
  options?: MapPaymentUserMessageOptions,
): string {
  const fallback = options?.fallback ?? DEFAULT_PAYMENT_USER_MESSAGE;

  if (error == null) {
    return fallback;
  }

  if (typeof error === "string") {
    return mapPaymentUserMessage(error, { fallback });
  }

  const err = error as {
    errorCode?: string;
    code?: string;
    message?: string;
  };

  const code = err.errorCode ?? err.code ?? null;
  if (code) {
    return mapPaymentUserMessage(code, { fallback });
  }

  if (typeof err.message === "string" && err.message.trim()) {
    const message = err.message.trim();
    if (KNOWN_FRIENDLY_MESSAGES.has(message) || message === fallback) {
      return message;
    }
    if (looksLikeErrorCode(message)) {
      return mapPaymentUserMessage(message, { fallback });
    }
    return fallback;
  }

  return fallback;
}
