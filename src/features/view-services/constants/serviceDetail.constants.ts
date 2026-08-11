import type { EstimatedDurationHintKey } from "@/lib/contracts/generate-smart-description/allowedValues";

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

export function getDurationLabel(
  duration: string | null | undefined,
): string | null {
  if (!duration) return null;
  return DURATION_LABELS[duration as EstimatedDurationHintKey] ?? null;
}

export const URGENCY_CONFIG: Record<
  string,
  { label: string; variant: "destructive" | "warning" | "default" }
> = {
  high: { label: "Urgente", variant: "destructive" },
  medium: { label: "Média prioridade", variant: "warning" },
  low: { label: "Baixa prioridade", variant: "default" },
};

export function getUrgencyConfig(
  urgency: string | null | undefined,
): { label: string; variant: "destructive" | "warning" | "default" } | null {
  if (!urgency) return null;
  return URGENCY_CONFIG[urgency] ?? null;
}

export const COMPLEXITY_LABELS: Record<string, string> = {
  simple: "Simples",
  medium: "Média",
  complex: "Complexo",
};

export function getComplexityLabel(
  complexity: string | null | undefined,
): string | null {
  if (!complexity) return null;
  return COMPLEXITY_LABELS[complexity] ?? complexity;
}

export const SUGGESTED_ITEMS_TOOLTIP_TEXT =
  "Itens sugeridos com base no pedido de orçamento do cliente. Eles podem ser utilizados, mas podem estar imprecisos.";

/** Matches dashboard list pages (e.g. MyServicesPageShell). */
export const SERVICE_DETAIL_PAGE_MAX_WIDTH_CLASS = "max-w-5xl";

export const SERVICE_DETAIL_PAGE_SHELL_CLASS =
  "mx-auto w-full min-w-0 max-w-5xl px-4 py-6";

/** Desktop service-detail sheet width (mobile stays full-bleed). */
export const SERVICE_DETAIL_SHEET_WIDTH_CLASS = "w-full sm:w-[70vw] sm:max-w-[70vw]";

/** Floating CTA bar width when hosted inside the detail sheet. */
export const SERVICE_DETAIL_SHEET_FLOATING_ACTIONS_WIDTH_CLASS =
  "w-[calc(100%-2rem)] sm:w-[calc(70vw-2rem)]";
