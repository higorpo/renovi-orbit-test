import {
  addCalendarDaysIso,
  AMERICA_SAO_PAULO_TZ,
  todayInSaoPauloIso,
  todayInTimeZoneIso,
} from "@/lib/utils/calendarDate";
import {
  SERVICE_JOURNEY_LABELS,
  SERVICE_JOURNEY_PAYMENT_LABEL_COMPLETED,
  SERVICE_JOURNEY_PAYMENT_LABEL_PENDING,
  SERVICE_JOURNEY_SUBTEXT,
} from "../constants/serviceJourney.constants";
import type {
  PresentedServiceJourneyMilestone,
  ServiceJourneyMilestone,
  ServiceJourneyMilestoneKey,
  ServiceJourneyMilestoneStatus,
} from "../types/serviceJourney.types";

export interface PresentServiceJourneyOptions {
  /** When rating is current after auto-complete (CS COMPLETED without rating). */
  ratingOptional?: boolean;
  now?: Date;
}

function formatJourneyTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    timeZone: AMERICA_SAO_PAULO_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats milestone timestamps in BRT with an explicit clock time so the
 * vertical timeline stays chronologically readable (never relative-only).
 * "Hoje, HH:mm" / "Ontem, HH:mm" / "dd/mm/yyyy, HH:mm".
 */
export function formatJourneyOccurredAt(
  iso: string,
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const dayIso = todayInTimeZoneIso(AMERICA_SAO_PAULO_TZ, date);
  const todayIso = todayInSaoPauloIso(now);
  const yesterdayIso = addCalendarDaysIso(todayIso, -1);
  const time = formatJourneyTime(date);

  if (dayIso === todayIso) return `Hoje, ${time}`;
  if (dayIso === yesterdayIso) return `Ontem, ${time}`;

  const dateLabel = date.toLocaleDateString("pt-BR", {
    timeZone: AMERICA_SAO_PAULO_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${dateLabel}, ${time}`;
}

function getMilestoneLabel(
  key: ServiceJourneyMilestoneKey,
  status: ServiceJourneyMilestoneStatus,
): string {
  if (key === "payment") {
    return status === "completed"
      ? SERVICE_JOURNEY_PAYMENT_LABEL_COMPLETED
      : SERVICE_JOURNEY_PAYMENT_LABEL_PENDING;
  }
  return SERVICE_JOURNEY_LABELS[key];
}

/** Default guidance copy for current / upcoming (not the immediate next step). */
function getMilestoneGuidanceSubtext(
  key: ServiceJourneyMilestoneKey,
  status: Exclude<ServiceJourneyMilestoneStatus, "completed">,
  ratingOptional: boolean,
): string | null {
  switch (key) {
    case "professionals_interested":
      return status === "current"
        ? SERVICE_JOURNEY_SUBTEXT.professionalsInterestedCurrent
        : SERVICE_JOURNEY_SUBTEXT.professionalsInterestedUpcoming;
    case "quote_received":
      return status === "current"
        ? SERVICE_JOURNEY_SUBTEXT.quoteReceivedCurrent
        : SERVICE_JOURNEY_SUBTEXT.quoteReceivedUpcoming;
    case "quote_approved":
      return status === "current"
        ? SERVICE_JOURNEY_SUBTEXT.quoteApprovedCurrent
        : SERVICE_JOURNEY_SUBTEXT.quoteApprovedUpcoming;
    case "payment":
      return status === "current"
        ? SERVICE_JOURNEY_SUBTEXT.paymentCurrent
        : SERVICE_JOURNEY_SUBTEXT.paymentUpcoming;
    case "service_scheduled":
      return status === "current"
        ? SERVICE_JOURNEY_SUBTEXT.serviceScheduledCurrent
        : SERVICE_JOURNEY_SUBTEXT.serviceScheduledUpcoming;
    case "service_executed":
      return status === "current"
        ? SERVICE_JOURNEY_SUBTEXT.serviceExecutedCurrent
        : SERVICE_JOURNEY_SUBTEXT.serviceExecutedUpcoming;
    case "rating":
      if (status === "current" && ratingOptional) {
        return SERVICE_JOURNEY_SUBTEXT.ratingOptional;
      }
      return SERVICE_JOURNEY_SUBTEXT.ratingExperience;
    case "cancelled":
      return status === "current" ? SERVICE_JOURNEY_SUBTEXT.cancelledCurrent : null;
    case "in_dispute":
      return status === "current" ? SERVICE_JOURNEY_SUBTEXT.inDisputeCurrent : null;
    case "request_created":
      return null;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function presentServiceJourneyMilestone(
  milestone: ServiceJourneyMilestone,
  options: PresentServiceJourneyOptions & { isImmediateNext?: boolean } = {},
): PresentedServiceJourneyMilestone {
  const ratingOptional = Boolean(options.ratingOptional);
  const now = options.now ?? new Date();
  const label = getMilestoneLabel(milestone.key, milestone.status);

  if (milestone.status === "completed") {
    return {
      key: milestone.key,
      status: milestone.status,
      label,
      secondaryText: milestone.occurredAt
        ? formatJourneyOccurredAt(milestone.occurredAt, now)
        : null,
    };
  }

  const secondaryText =
    milestone.status === "upcoming" && options.isImmediateNext
      ? SERVICE_JOURNEY_SUBTEXT.nextStep
      : getMilestoneGuidanceSubtext(milestone.key, milestone.status, ratingOptional);

  return {
    key: milestone.key,
    status: milestone.status,
    label,
    secondaryText,
  };
}

export function presentServiceJourneyMilestones(
  milestones: ServiceJourneyMilestone[],
  options: PresentServiceJourneyOptions = {},
): PresentedServiceJourneyMilestone[] {
  const immediateNextIndex = milestones.findIndex((m) => m.status === "upcoming");

  return milestones.map((milestone, index) =>
    presentServiceJourneyMilestone(milestone, {
      ...options,
      isImmediateNext: index === immediateNextIndex,
    }),
  );
}
