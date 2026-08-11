import { useClientServiceJourney } from "../hooks/useClientServiceJourney";
import { ServiceJourneyCard } from "./ServiceJourneyCard";
import { ServiceJourneyCardSkeleton } from "./ServiceJourneyCardSkeleton";

export interface ClientServiceJourneySectionProps {
  serviceRequestId: string | undefined;
  /** When CS is COMPLETED without a rating (optional evaluation). */
  ratingOptional?: boolean;
  className?: string;
}

/**
 * Client-only journey timeline: owns fetch, skeleton, and empty handling.
 * Renders nothing when there is no id or the query returns no milestones.
 */
export function ClientServiceJourneySection({
  serviceRequestId,
  ratingOptional = false,
  className,
}: ClientServiceJourneySectionProps) {
  const { milestones, isLoading } = useClientServiceJourney({
    serviceRequestId,
    enabled: Boolean(serviceRequestId?.trim()),
    ratingOptional,
  });

  if (isLoading) {
    return <ServiceJourneyCardSkeleton className={className} />;
  }

  if (milestones.length === 0) {
    return null;
  }

  return <ServiceJourneyCard milestones={milestones} className={className} />;
}
