export function formatProposalCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatProposalDateTime(value: string | null | undefined): string {
  if (!value) return "Data indisponível";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsedDate);
}

export function translateProposalStatus(status: string | null): string {
  const normalized = (status ?? "submitted").toLowerCase();
  const mapping: Record<string, string> = {
    submitted: "Aguardando avaliação do cliente",
    accepted: "Aceita pelo cliente",
    rejected: "Rejeitada pelo cliente",
    withdrawn: "Proposta retirada",
  };
  return mapping[normalized] ?? "Aguardando avaliação do cliente";
}
