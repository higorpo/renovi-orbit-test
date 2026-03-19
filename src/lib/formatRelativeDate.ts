const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 604_800_000;

/**
 * Format a date as relative time in PT-BR.
 * Examples: "Agora", "Há 5 min", "Há 2 h", "Há 3 dias", "Há 1 semana"
 */
export function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();

  if (diff < MINUTE) return "Agora";
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `Há ${mins} min`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `Há ${hours} h`;
  }
  if (diff < WEEK) {
    const days = Math.floor(diff / DAY);
    return `Há ${days} dia${days > 1 ? "s" : ""}`;
  }

  const weeks = Math.floor(diff / WEEK);
  if (weeks <= 4) return `Há ${weeks} semana${weeks > 1 ? "s" : ""}`;

  return new Date(dateStr).toLocaleDateString("pt-BR");
}
