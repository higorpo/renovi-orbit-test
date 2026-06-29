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

export function mapServiceCompletionErrorMessage(errorCode: string): string {
  return SERVICE_COMPLETION_ERROR_MESSAGES[errorCode]
    ?? "Não foi possível concluir a operação. Tente novamente.";
}
