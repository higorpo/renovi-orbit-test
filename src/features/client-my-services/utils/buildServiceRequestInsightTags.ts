import type { StatusBadgeVariant } from "../constants/statusBadge";

export interface ServiceRequestInsightTag {
  key: string;
  label: string;
  variant: StatusBadgeVariant;
}

const URGENCY_LABELS: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  high: { label: "Urgente", variant: "destructive" },
  medium: { label: "Média prioridade", variant: "warning" },
  low: { label: "Baixa prioridade", variant: "secondary" },
};

const COMPLEXITY_LABELS: Record<string, string> = {
  simple: "Escopo simples",
  medium: "Escopo médio",
  complex: "Escopo complexo",
};

const DURATION_LABELS: Record<string, string> = {
  under_1h: "Menos de 1 h",
  "1_to_2h": "1–2 h",
  "2_to_4h": "2–4 h",
  "4_to_8h": "4–8 h",
  "1_day": "1 dia",
  "1_to_2_days": "1–2 dias",
  "2_to_5_days": "2–5 dias",
  "5_to_10_days": "5–10 dias",
  "10_to_20_days": "10–20 dias",
  "20_to_30_days": "20–30 dias",
  over_30_days: "30+ dias",
};

export function buildServiceRequestInsightTags(input: {
  tags?: string[] | null;
  urgency?: string | null;
  scopeComplexity?: string | null;
  estimatedDurationHint?: string | null;
  missingInfoWarnings?: string[] | null;
}): ServiceRequestInsightTag[] {
  const result: ServiceRequestInsightTag[] = [];
  const seen = new Set<string>();

  const push = (key: string, label: string, variant: StatusBadgeVariant = "outline") => {
    const normalized = label.trim();
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    result.push({ key, label: normalized, variant });
  };

  if (input.urgency) {
    const config = URGENCY_LABELS[input.urgency] ?? {
      label: `Urgência: ${input.urgency}`,
      variant: "outline" as const,
    };
    push(`urgency:${input.urgency}`, config.label, config.variant);
  }

  if (input.scopeComplexity) {
    const label =
      COMPLEXITY_LABELS[input.scopeComplexity] ?? `Complexidade: ${input.scopeComplexity}`;
    push(`complexity:${input.scopeComplexity}`, label, "secondary");
  }

  if (input.estimatedDurationHint) {
    const label =
      DURATION_LABELS[input.estimatedDurationHint] ??
      `Duração: ${input.estimatedDurationHint}`;
    push(`duration:${input.estimatedDurationHint}`, label, "secondary");
  }

  (input.tags ?? []).forEach((tag, index) => {
    push(`tag:${index}:${tag}`, tag, "outline");
  });

  (input.missingInfoWarnings ?? []).forEach((warning, index) => {
    push(`warning:${index}:${warning}`, warning, "warning");
  });

  return result;
}
