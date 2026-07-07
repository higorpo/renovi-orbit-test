const CANCELLATION_ERROR_MESSAGES: Record<string, string> = {
  PAYMENT_IN_ANALYSIS:
    "Seu pagamento está em análise antifraude. Aguarde a conclusão ou entre em contato com o suporte.",
  SERVICE_NOT_CANCELLABLE: "Este serviço não pode mais ser cancelado.",
  INVALID_SCHEDULE_STATE:
    "Não é possível cancelar neste momento. Atualize a página e tente novamente.",
  FORBIDDEN: "Você não tem permissão para cancelar este serviço.",
  SERVICE_NOT_FOUND: "Serviço não encontrado.",
  SCHEDULE_NOT_FOUND: "Agendamento de pagamento não encontrado.",
  TRANSACTION_NOT_FOUND:
    "Não encontramos a transação de pagamento. Entre em contato com o suporte.",
  refund_failed:
    "Não foi possível processar o estorno no momento. Tente novamente ou fale com o suporte.",
  PAYMENT_SCHEDULE_TERMINAL_STATE:
    "Não é possível cancelar neste momento. O pagamento já está em um estado final.",
  PAYMENT_SCHEDULE_INVALID_TRANSITION:
    "Não é possível cancelar neste momento. Atualize a página e tente novamente.",
};

export function mapCancellationErrorMessage(errorCode: string): string {
  return CANCELLATION_ERROR_MESSAGES[errorCode]
    ?? "Não foi possível cancelar o serviço. Tente novamente.";
}
