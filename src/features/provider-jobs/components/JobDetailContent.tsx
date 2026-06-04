import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  canEditServiceRequestProposal,
  hasActiveServiceRequestProposal,
  isRejectedProposalStatus,
  ProposalComposerShellDialog,
  ServiceRequestProposalSummaryCard,
  useProposalPhotoUrls,
  useServiceRequestProposalComposer,
} from "@/features/negotiation-proposals";
import { getServiceCardStyle } from "@/features/request-quote";
import { formatDistance } from "@/lib/formatDistance";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { cn } from "@/lib/utils";
import {
  PROVIDER_JOBS_LIST_QUERY_KEY,
  PROVIDER_PROPOSAL_JOB_DETAIL_QUERY_KEY,
} from "../constants/queryKeys";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import { mapProviderJobToProposalSummary } from "../utils/mapProviderJobToProposalSummary";
import {
  mapSuggestedEquipmentToPt,
  mapSuggestedMaterialsToPt,
} from "../utils/suggestedItemsMapper";
import { JobDetailMetadataBadges } from "./JobDetailMetadataBadges";
import { JobDetailRequestSections } from "./JobDetailRequestSections";
import { JobDetailFloatingActions } from "./JobDetailFloatingActions";
import { getUrgencyConfig } from "./JobDetail.constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProviderJobChatNavigation } from "../hooks/useProviderJobChatNavigation";

interface JobDetailContentProps {
  job: ProviderJobItem;
  isInsideSheet?: boolean;
}

export function JobDetailContent({
  job,
  isInsideSheet = false,
}: JobDetailContentProps) {
  const queryClient = useQueryClient();
  const serviceStyle = getServiceCardStyle({
    icon_key: job.service_icon_key,
    color_key: job.service_color_key,
  });
  const suggestedEquipmentPt = mapSuggestedEquipmentToPt(job.suggested_equipment);
  const suggestedMaterialsPt = mapSuggestedMaterialsToPt(job.suggested_materials);
  const hasLatestProposal = Boolean(job.provider_proposal_id);
  const hasActiveProposal = hasActiveServiceRequestProposal(
    job.provider_proposal_id,
    job.provider_proposal_status,
  );
  const isViewingLatestProposalRow = job.is_latest_provider_proposal !== false;
  const showBrowseCtas = !hasActiveProposal && isViewingLatestProposalRow;
  const canEditProposal =
    hasLatestProposal &&
    isViewingLatestProposalRow &&
    canEditServiceRequestProposal(job.provider_proposal_status);
  const proposalComposer = useServiceRequestProposalComposer({
    serviceRequestId: job.id,
    existingProposal: {
      proposedAmount: job.provider_proposed_amount,
      description: job.provider_proposal_description,
      durationValue: job.provider_proposal_duration_value,
      durationUnit: job.provider_proposal_duration_unit,
      suggestedSlots: job.provider_proposal_suggested_slots,
      photos: job.provider_proposal_photos,
    },
    onSubmitSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [PROVIDER_PROPOSAL_JOB_DETAIL_QUERY_KEY, job.id],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: [PROVIDER_JOBS_LIST_QUERY_KEY],
        }),
      ]);
    },
  });
  const { urls: existingProposalPhotoUrls } = useProposalPhotoUrls(
    proposalComposer.existingPhotoPaths,
  );
  const proposalSummary = mapProviderJobToProposalSummary(job);
  const { openChat, isOpeningChat } = useProviderJobChatNavigation(job.id);

  const urgencyConfig = getUrgencyConfig(job.urgency);

  return (
    <div className="space-y-4 pb-24 md:pb-28">
      {isRejectedProposalStatus(job.provider_proposal_status) && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Orçamento rejeitado pelo cliente</AlertTitle>
          <AlertDescription className="mt-2 space-y-1">
            <p className="whitespace-pre-wrap text-sm">
              {job.provider_proposal_client_rejection_response?.trim() ||
                "O cliente rejeitou o orçamento sem deixar um comentário."}
            </p>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                serviceStyle.color,
              )}
              aria-hidden
            >
              <serviceStyle.Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                {job.service_title}
              </p>
              <h1 className="mt-0.5 text-xl font-bold leading-tight sm:text-2xl">
                {job.title}
              </h1>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {urgencyConfig && (
              <Badge variant={urgencyConfig.variant} className="gap-1">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {urgencyConfig.label}
              </Badge>
            )}
            {job.exact_area_match && (
              <Badge
                variant="outline"
                className="gap-1 border-border/80 font-normal text-muted-foreground"
              >
                <CheckCircle className="h-3 w-3 opacity-80" aria-hidden />
                Na sua área
              </Badge>
            )}
            <Badge
              variant="outline"
              className="gap-1 border-border/80 font-normal text-muted-foreground"
            >
              <MessageSquare className="h-3 w-3 opacity-80" aria-hidden />
              {job.proposal_count}{" "}
              {job.proposal_count === 1 ? "orçamento" : "orçamentos"}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {job.neighborhood}, {job.city} ({job.state})
            </span>
            <span className="font-medium text-foreground">
              {formatDistance(job.distance_km)} de você
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              {formatRelativeDate(job.created_at)}
            </span>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Solicitante: {job.masked_client_name}
          </p>
        </CardHeader>

        <Separator />

        <CardContent className="space-y-6 pt-4">
          <JobDetailMetadataBadges job={job} />

          <JobDetailRequestSections
            job={job}
            suggestedEquipmentPt={suggestedEquipmentPt}
            suggestedMaterialsPt={suggestedMaterialsPt}
          />

          <ProposalComposerShellDialog
            title="Enviar orçamento"
            submitLabel="Enviar orçamento"
            submittingLabel="Enviando..."
            open={proposalComposer.isOpen}
            isSubmitting={proposalComposer.isSubmitting}
            canSubmit={proposalComposer.canSubmitProposal}
            form={proposalComposer.form}
            availabilityFieldArray={proposalComposer.availabilityFieldArray}
            existingPhotoUrls={existingProposalPhotoUrls}
            newPhotos={proposalComposer.newPhotos}
            photosCount={proposalComposer.photosCount}
            pricing={proposalComposer.pricing}
            isPricingLoading={proposalComposer.isPricingLoading}
            maxDescriptionLength={proposalComposer.maxDescriptionLength}
            maxPhotos={proposalComposer.maxPhotos}
            onOpenChange={(open) => {
              if (!open) proposalComposer.closeComposer();
            }}
            onPhotoAdd={proposalComposer.addPhotos}
            onExistingPhotoRemove={proposalComposer.removeExistingPhoto}
            onNewPhotoRemove={proposalComposer.removeNewPhoto}
            onAvailabilitySlotAdd={proposalComposer.addAvailabilitySlot}
            onAvailabilitySlotRemove={proposalComposer.removeAvailabilitySlot}
            onSubmit={async () => {
              await proposalComposer.submitProposal();
            }}
          />
        </CardContent>
      </Card>

      {proposalSummary && (
        <ServiceRequestProposalSummaryCard
          summary={proposalSummary}
          canEdit={canEditProposal}
          onEdit={() => proposalComposer.openComposer({ mode: "edit" })}
        />
      )}

      {showBrowseCtas && (
        <JobDetailFloatingActions
          isInsideSheet={isInsideSheet}
          isOpeningChat={isOpeningChat}
          onOpenChat={openChat}
        />
      )}
    </div>
  );
}
