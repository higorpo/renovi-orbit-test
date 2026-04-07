/**
 * User-facing PT-BR labels for stable `fallbackReason` codes from useServiceSchema.
 */
export function formatServiceSchemaFallbackReason(code: string): string {
  const map: Record<string, string> = {
    no_service_slug_or_id: "Nenhum serviço selecionado.",
    loading: "Carregando…",
    service_fetch_failed: "Não foi possível carregar os dados do serviço.",
    service_not_found: "Serviço não encontrado.",
    no_form: "Não há formulário vinculado a este serviço.",
    form_inactive: "O formulário deste serviço não está ativo.",
    no_v2_schema: "O formulário está em um formato incompatível.",
    schema_validation_failed: "O formulário contém erros de configuração.",
  };
  return map[code] ?? "Não foi possível carregar o formulário.";
}
