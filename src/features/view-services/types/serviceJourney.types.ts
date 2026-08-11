/** Milestone keys returned by `get_client_service_journey`. */
export type ServiceJourneyMilestoneKey =
  | "request_created"
  | "professionals_interested"
  | "quote_received"
  | "quote_approved"
  | "payment"
  | "service_scheduled"
  | "service_executed"
  | "rating"
  | "cancelled"
  | "in_dispute";

export type ServiceJourneyMilestoneStatus = "completed" | "current" | "upcoming";

/** Raw milestone from the RPC (snake_case wire format). */
export interface ServiceJourneyMilestoneRpc {
  key: string;
  status: string;
  occurred_at: string | null;
}

/** Domain milestone after API parse. */
export interface ServiceJourneyMilestone {
  key: ServiceJourneyMilestoneKey;
  status: ServiceJourneyMilestoneStatus;
  occurredAt: string | null;
}

export interface ClientServiceJourney {
  milestones: ServiceJourneyMilestone[];
}

/** UI-ready milestone after presentation mapping. */
export interface PresentedServiceJourneyMilestone {
  key: ServiceJourneyMilestoneKey;
  status: ServiceJourneyMilestoneStatus;
  label: string;
  /** Timestamp for completed; guidance copy for current/upcoming when applicable. */
  secondaryText: string | null;
}
