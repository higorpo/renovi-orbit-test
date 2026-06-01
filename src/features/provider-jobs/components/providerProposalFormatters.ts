import { getProposalStatusLabel } from "./JobDetail.constants";

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
  return getProposalStatusLabel(status);
}

export function formatProposalDateOnly(value: string | null | undefined): string {
  if (!value) return "Data indisponível";
  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(parsedDate);
}

export function translateProposalShift(
  shift: "morning" | "afternoon" | "full_day" | string,
): string {
  if (shift === "morning") return "Manhã";
  if (shift === "afternoon") return "Tarde";
  if (shift === "full_day") return "Dia inteiro";
  return shift;
}
