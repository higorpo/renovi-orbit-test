import type { EstimatedDurationHintKey } from "supabase/functions/generate-smart-description/allowedValues";

export const DURATION_LABELS: Record<EstimatedDurationHintKey, string> = {
  under_1h: "Menos de 1 hora",
  "1_to_2h": "1 a 2 horas",
  "2_to_4h": "2 a 4 horas",
  "4_to_8h": "4 a 8 horas",
  "1_day": "1 dia",
  "1_to_2_days": "1 a 2 dias",
  "2_to_5_days": "2 a 5 dias",
  "5_to_10_days": "5 a 10 dias",
  "10_to_20_days": "10 a 20 dias",
  "20_to_30_days": "20 a 30 dias",
  over_30_days: "Mais de 30 dias",
};

export const URGENCY_CONFIG: Record<
  string,
  { label: string; variant: "destructive" | "warning" | "default" }
> = {
  high: { label: "Urgente", variant: "destructive" },
  medium: { label: "Média prioridade", variant: "warning" },
  low: { label: "Baixa prioridade", variant: "default" },
};

export const COMPLEXITY_LABELS: Record<string, string> = {
  simple: "Simples",
  medium: "Média",
  complex: "Complexo",
};

export const SUGGESTED_ITEMS_TOOLTIP_TEXT =
  "Itens sugeridos com base no pedido de orçamento do cliente. Eles podem ser utilizados, mas podem estar imprecisos.";
