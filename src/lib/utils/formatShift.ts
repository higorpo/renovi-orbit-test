const SHIFT_LABELS: Record<string, string> = {
  morning: "manhã",
  afternoon: "tarde",
  full_day: "dia inteiro",
};

export type FormatShiftOptions = {
  /** When true, returns "Manhã" / "Tarde" / "Dia inteiro". Default: lowercase. */
  capitalize?: boolean;
};

/** Translates a service shift code to a pt-BR label. */
export function formatShift(shift: string, options?: FormatShiftOptions): string {
  const label = SHIFT_LABELS[shift] ?? shift;
  if (!options?.capitalize || label === shift) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Suffix for schedule highlight titles (fixed shift, not clock time). */
export function formatShiftHighlightSuffix(shift: string): string {
  const label = formatShift(shift);
  if (shift === "full_day") return ` · ${label}`;
  return ` · turno da ${label}`;
}
