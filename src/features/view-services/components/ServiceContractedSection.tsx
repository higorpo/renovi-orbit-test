import { Link } from "react-router";
import { Calendar, Clock3, Tag } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PaymentDisputeStatus } from "@/features/payments";
import {
  getProviderProfilePath,
  usePublicProfileImageUrl,
} from "@/features/provider-profile";
import { formatCurrency } from "@/lib/formatCurrency";
import { initialsFromName } from "@/lib/utils/initialsFromName";
import { cn } from "@/lib/utils";
import { useProviderRatingSummary } from "../hooks/useProviderRatingSummary";
import type { ContractedServiceSummary } from "../types/service.types";
import { getContractedServiceStatusLabel } from "../utils/contractedServiceStatusLabel";
import { formatScheduledSummary } from "../utils/formatScheduledSummary";
import { ServiceDetailSection } from "./ServiceDetailSection";
import { Star } from "lucide-react";

export interface ServiceContractedSectionProps {
  contracted: ContractedServiceSummary;
  /** Client sees rich provider header; provider sees schedule/status/amount only. */
  viewerRole: "client" | "provider";
}

function formatRatingAvg(avg: number): string {
  return avg.toFixed(1).replace(".", ",");
}

function ratingsCountLabel(count: number): string {
  return count === 1 ? "1 avaliação" : `${count} avaliações`;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="text-caption text-muted-foreground">{label}</p>
        <div className="text-sm font-semibold leading-snug text-ink">{children}</div>
      </div>
    </div>
  );
}

function ContractedDetailRows({ contracted }: { contracted: ContractedServiceSummary }) {
  const scheduled = formatScheduledSummary(contracted);
  const statusLabel = getContractedServiceStatusLabel(contracted.status);
  const amount =
    contracted.finalAmount != null ? formatCurrency(contracted.finalAmount) : null;

  return (
    <div className="space-y-3.5">
      {scheduled ? (
        <DetailRow icon={Calendar} label="Data agendada">
          <span>
            {scheduled.dateLabel}
            {scheduled.shiftLabel ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                ({scheduled.shiftLabel})
              </span>
            ) : null}
          </span>
        </DetailRow>
      ) : null}

      <DetailRow icon={Clock3} label="Status">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/70" aria-hidden />
          {statusLabel}
        </span>
      </DetailRow>

      {amount ? (
        <DetailRow icon={Tag} label="Valor do serviço">
          {amount}
        </DetailRow>
      ) : null}

      {contracted.farRecapturePending ? (
        <p className="text-caption text-muted-foreground" data-testid="far-recapture-pending-notice">
          Estamos reajustando a cobrança para a nova data. Isso pode levar alguns minutos.
        </p>
      ) : null}
    </div>
  );
}

function ClientProviderHeader({ contracted }: { contracted: ContractedServiceSummary }) {
  const provider = contracted.provider;
  const { url } = usePublicProfileImageUrl(provider?.profileImagePath);
  const { data: rating } = useProviderRatingSummary(provider?.id);
  const hasRatings =
    Boolean(rating) && rating!.ratingCount > 0 && rating!.ratingAvg != null;

  if (!provider) return null;

  return (
    <div className="flex min-w-0 items-center gap-3" data-testid="contracted-provider-header">
      <Avatar className="h-12 w-12 shrink-0">
        {url ? <AvatarImage src={url} alt="" /> : null}
        <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
          {initialsFromName(provider.displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 space-y-1">
        <p className="truncate font-display text-sm font-semibold text-ink">
          {provider.displayName}
        </p>
        {hasRatings ? (
          <p
            className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption"
            aria-label={`${formatRatingAvg(rating!.ratingAvg!)} de 5, ${ratingsCountLabel(rating!.ratingCount)}`}
          >
            <Star
              className="h-3.5 w-3.5 fill-amber-400 text-amber-500"
              strokeWidth={1.5}
              aria-hidden
            />
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {formatRatingAvg(rating!.ratingAvg!)}
            </span>
            <span className="text-muted-foreground">
              ({ratingsCountLabel(rating!.ratingCount)})
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Contracted service summary card.
 * Client: provider reputation header + schedule/status/amount + profile CTA.
 * Provider: schedule/status/amount only (no self-profile block).
 */
export function ServiceContractedSection({
  contracted,
  viewerRole,
}: ServiceContractedSectionProps) {
  const isClient = viewerRole === "client";
  const providerSlug = contracted.provider?.slug?.trim() || null;

  return (
    <ServiceDetailSection
      title="Serviço contratado"
      className="border-border bg-card shadow-elevation-1"
      data-testid="contracted-section"
    >
      <div className="mb-3 empty:hidden">
        <PaymentDisputeStatus contractedServiceId={contracted.id} />
      </div>

      {isClient ? (
        <>
          <ClientProviderHeader contracted={contracted} />
          <div className="my-4 border-t border-border/80" />
        </>
      ) : null}

      <ContractedDetailRows contracted={contracted} />

      {isClient && providerSlug ? (
        <Button
          asChild
          type="button"
          variant="outline"
          className={cn(
            "mt-4 h-11 w-full rounded-lg border-border font-semibold text-foreground",
          )}
        >
          <Link to={getProviderProfilePath(providerSlug)}>Ver perfil do profissional</Link>
        </Button>
      ) : null}
    </ServiceDetailSection>
  );
}
