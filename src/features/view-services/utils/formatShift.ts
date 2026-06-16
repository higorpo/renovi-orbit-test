const SHIFT_LABELS: Record<string, string> = {
  morning: "manhã",
  afternoon: "tarde",
  full_day: "dia inteiro",
};

export function formatShift(shift: string): string {
  return SHIFT_LABELS[shift] ?? shift;
}

/** Suffix for schedule highlight titles (fixed shift, not clock time). */
export function formatShiftHighlightSuffix(shift: string): string {
  const label = formatShift(shift);
  if (shift === "full_day") return ` · ${label}`;
  return ` · turno da ${label}`;
}
