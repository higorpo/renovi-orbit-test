export function formatChatMessageGroupTimestamp(
  iso: string,
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === today) return time;
  if (date.toDateString() === yesterday.toDateString()) return `Ontem ${time}`;

  const datePart = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  return `${datePart} ${time}`;
}
