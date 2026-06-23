import { formatDistance } from "@/lib/formatDistance";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import type { ListProviderOpportunityItem } from "../types/provider-jobs.types";

export interface JobCardPresentation {
  description: string | null;
  locationLine: string;
  publishedLine: string;
  showFallbackBadge: boolean;
  showUrgency: boolean;
}

function normalizeDescription(description: string | null | undefined): string | null {
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
}

function formatPublishedLine(dateStr: string): string {
  const relative = formatRelativeDate(dateStr);
  if (relative === "Agora") return "Publicado agora";
  if (relative.startsWith("Há ")) return `Publicado há ${relative.slice(3)}`;
  return `Publicado em ${relative}`;
}

function buildLocationLine(job: ListProviderOpportunityItem): string {
  if (job.distance_km != null) {
    return `${job.neighborhood} · ${formatDistance(job.distance_km)} de você`;
  }
  return job.neighborhood;
}

export function getJobCardPresentation(job: ListProviderOpportunityItem): JobCardPresentation {
  return {
    description: normalizeDescription(job.description),
    locationLine: buildLocationLine(job),
    publishedLine: formatPublishedLine(job.granted_at),
    showFallbackBadge: job.source === "fallback",
    showUrgency: job.urgency === "high" || job.urgency === "medium",
  };
}
