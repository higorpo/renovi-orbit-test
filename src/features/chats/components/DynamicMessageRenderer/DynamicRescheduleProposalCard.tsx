import type { ProfileRole } from "@/features/auth";
import {
  formatRescheduleSlot,
  getRescheduleCardSurfaceClass,
  getRescheduleStatusIcon,
  isRescheduleSlotDateRange,
  resolveEndedRescheduleCardCopy,
  resolveRescheduleCardCtas,
  resolveRescheduleCardDescription,
  resolveRescheduleCardHeadline,
  resolveRescheduleSlotSectionLabel,
  shouldShowRescheduleSlotSection,
  readRescheduleSlotFromWorkflowMessage,
  resolveRescheduleCardDisplaySlot,
  type RescheduleCardCtaId,
  useRescheduleTimelineHydration,
} from "@/features/service-reschedule";
import { CalendarDays } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { metrics } from "@/lib/sentry";
import type { ChatMessageListItem } from "../../types/chats.types";
import { CHAT_INTERACTIVE_FOCUS, CHAT_MIN_TOUCH_TARGET } from "../../utils/conversationVisualState";
import { DynamicRescheduleProposalCardSkeleton } from "./DynamicRescheduleProposalCardSkeleton";

export type RescheduleCardAction = RescheduleCardCtaId;

export interface DynamicRescheduleProposalCardProps {
  chatId: string;
  message: ChatMessageListItem;
  viewerRole: ProfileRole;
  isOutgoing: boolean;
  onRescheduleAction?: (action: RescheduleCardAction, requestId: string) => void;
  className?: string;
}

export function DynamicRescheduleProposalCard({
  chatId,
  message,
  viewerRole,
  isOutgoing,
  onRescheduleAction,
  className,
}: DynamicRescheduleProposalCardProps) {
  const requestId = message.linked_entity_id;
  const { snapshot, isLoading } = useRescheduleTimelineHydration(
    chatId,
    requestId,
    Boolean(requestId),
  );

  const activeRequest = snapshot?.activeRequest;
  const endedCopy = resolveEndedRescheduleCardCopy();
  const status = activeRequest?.status ?? null;
  const headline = status
    ? resolveRescheduleCardHeadline(status, viewerRole)
    : endedCopy.headline;
  const description = status
    ? resolveRescheduleCardDescription(status, viewerRole)
    : endedCopy.description;
  const StatusIcon = status ? getRescheduleStatusIcon(status) : getRescheduleStatusIcon("EXPIRED");

  const messageSlot = readRescheduleSlotFromWorkflowMessage(message);
  const slotForDisplay = resolveRescheduleCardDisplaySlot(
    status,
    messageSlot,
    activeRequest?.original_slot ?? null,
    activeRequest?.proposed_slot ?? null,
  );

  const isDateRange = isRescheduleSlotDateRange(slotForDisplay);
  const slotSectionLabel = status
    ? resolveRescheduleSlotSectionLabel(status, isDateRange)
    : isDateRange
      ? "Período proposto"
      : "Data proposta";
  const showSlotSection = status
    ? shouldShowRescheduleSlotSection(status, slotForDisplay, isDateRange)
    : Boolean(slotForDisplay);

  const ctas = status
    ? resolveRescheduleCardCtas(status, viewerRole, {
        canPropose: Boolean(snapshot?.canProposeReschedule),
        canAccept: Boolean(snapshot?.canAcceptReschedule),
        canRequestAdjustment: Boolean(snapshot?.canRequestAdjustment),
        canCancel: Boolean(snapshot?.canCancelReschedule),
      })
    : [];

  useEffect(() => {
    if (isLoading || !activeRequest) return;

    metrics.count("chats.dynamic_reschedule_card_render", 1, {
      status: String(activeRequest.status),
    });
  }, [activeRequest, isLoading]);

  if (!requestId) {
    return (
      <div className={cn("rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground", className)}>
        Não foi possível vincular esta solicitação de reagendamento.
      </div>
    );
  }

  if (isLoading) {
    return <DynamicRescheduleProposalCardSkeleton isOutgoing={isOutgoing} className={className} />;
  }

  return (
    <article
      className={cn(
        "w-full max-w-[88%] rounded-2xl border px-4 py-4 shadow-sm",
        status ? getRescheduleCardSurfaceClass(status) : "border-muted-foreground/25 bg-muted/40",
        isOutgoing ? "ml-auto" : "mr-auto",
        className,
      )}
      aria-label={headline}
    >
      <div className="flex items-start gap-2">
        <StatusIcon className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{headline}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {showSlotSection && slotForDisplay && slotSectionLabel ? (
            <div className="rounded-lg border border-primary/20 bg-background/70 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {slotSectionLabel}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatRescheduleSlot(slotForDisplay)}
              </p>
            </div>
          ) : null}

          {ctas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {ctas.map((cta) => (
                <Button
                  key={cta.id}
                  type="button"
                  size="sm"
                  variant={cta.variant}
                  className={cn(
                    "rounded-full px-4",
                    CHAT_MIN_TOUCH_TARGET,
                    CHAT_INTERACTIVE_FOCUS,
                    (cta.id === "accept" || cta.id === "propose") && "font-semibold",
                  )}
                  onClick={() => onRescheduleAction?.(cta.id, requestId)}
                >
                  {cta.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
