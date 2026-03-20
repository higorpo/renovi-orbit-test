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
import { getServiceCardStyle } from "@/features/request-quote";
import { formatDistance } from "@/lib/formatDistance";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { cn } from "@/lib/utils";
import { useProviderJobQuestionComposer } from "../hooks/useProviderJobQuestionComposer";
import { useProviderProposalPhotoUrls } from "../hooks/useProviderProposalPhotoUrls";
import { useProviderProposalComposer } from "../hooks/useProviderProposalComposer";
import { MAX_PROPOSALS_PER_REQUEST } from "../types/provider-jobs.types";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import {
  mapSuggestedEquipmentToPt,
  mapSuggestedMaterialsToPt,
} from "../utils/suggestedItemsMapper";
import { JobDetailMetadataBadges } from "./JobDetailMetadataBadges";
import { JobQuestionComposerDialog } from "./JobQuestionComposerDialog";
import { JobQuestionPromptCard } from "./JobQuestionPromptCard";
import { JobQuestionsFeed } from "./JobQuestionsFeed";
import { ProviderProposalComposerDialog } from "./ProviderProposalComposerDialog";
import { ProviderProposalSummaryCard } from "./ProviderProposalSummaryCard";
import { JobDetailRequestSections } from "./JobDetailRequestSections";
import { JobDetailFloatingActions } from "./JobDetailFloatingActions";
import { getUrgencyConfig } from "./JobDetail.constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface JobDetailContentProps {
  job: ProviderJobItem;
  isInsideSheet?: boolean;
}

export function JobDetailContent({
  job,
  isInsideSheet = false,
}: JobDetailContentProps) {
  const serviceStyle = getServiceCardStyle({
    icon_key: job.service_icon_key,
    color_key: job.service_color_key,
  });
  const suggestedEquipmentPt = mapSuggestedEquipmentToPt(job.suggested_equipment);
  const suggestedMaterialsPt = mapSuggestedMaterialsToPt(job.suggested_materials);
  const suggestedQuestions = job.suggested_questions ?? [];
  const {
    isOpen,
    isSubmitting,
    questionDraft,
    maxQuestionLength,
    setQuestionDraft,
    openComposer,
    closeComposer,
    submitQuestion,
  } = useProviderJobQuestionComposer(job.id);
  const hasLatestProposal = Boolean(job.provider_proposal_id);
  const hasActiveProposal =
    hasLatestProposal && job.provider_proposal_status !== "withdrawn";
  const canEditProposal =
    hasLatestProposal &&
    job.provider_proposal_status !== "accepted" &&
    job.provider_proposal_status !== "withdrawn";
  const {
    isOpen: isProposalOpen,
    isSubmitting: isProposalSubmitting,
    isPricingLoading,
    priceInput,
    descriptionDraft,
    durationValueInput,
    durationUnit,
    availabilitySlots,
    existingPhotoPaths,
    newPhotos,
    photosCount,
    pricing,
    maxDescriptionLength,
    maxPhotos,
    canSubmitProposal,
    openComposer: openProposalComposer,
    closeComposer: closeProposalComposer,
    setPriceInput,
    setDescriptionDraft,
    setDurationValueInput,
    setDurationUnit,
    updateAvailabilitySlot,
    addAvailabilitySlot,
    removeAvailabilitySlot,
    addPhotos,
    removeExistingPhoto,
    removeNewPhoto,
    submitProposal,
  } = useProviderProposalComposer(job.id, {
    proposedAmount: job.provider_proposed_amount,
    description: job.provider_proposal_description,
    durationValue: job.provider_proposal_duration_value,
    durationUnit: job.provider_proposal_duration_unit,
    suggestedSlots: job.provider_proposal_suggested_slots,
    photos: job.provider_proposal_photos,
  });
  const { urls: existingProposalPhotoUrls } = useProviderProposalPhotoUrls(
    existingPhotoPaths,
  );

  const urgencyConfig = getUrgencyConfig(job.urgency);

  return (
    <div className="space-y-4 pb-24 md:pb-28">
      {job.provider_proposal_status === "rejected" && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Proposta rejeitada pelo cliente</AlertTitle>
          <AlertDescription className="mt-2 space-y-1">
            <p className="whitespace-pre-wrap text-sm">
              {job.provider_proposal_client_rejection_response?.trim() ||
                "O cliente rejeitou a proposta sem deixar um comentário."}
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
              {job.proposal_count} de {MAX_PROPOSALS_PER_REQUEST} propostas
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

          {!hasActiveProposal && (
            <JobQuestionPromptCard
              suggestedQuestions={suggestedQuestions}
              onAskQuestion={() => openComposer()}
              onUseSuggestedQuestion={(question) =>
                openComposer({ prefilledQuestion: question })
              }
            />
          )}

          {!hasActiveProposal && (
            <JobQuestionComposerDialog
              open={isOpen}
              questionDraft={questionDraft}
              isSubmitting={isSubmitting}
              maxQuestionLength={maxQuestionLength}
              onOpenChange={(open) => {
                if (!open) closeComposer();
              }}
              onQuestionDraftChange={setQuestionDraft}
              onSubmit={async () => {
                await submitQuestion();
              }}
            />
          )}

          <ProviderProposalComposerDialog
            open={isProposalOpen}
            isSubmitting={isProposalSubmitting}
            isPricingLoading={isPricingLoading}
            priceInput={priceInput}
            descriptionDraft={descriptionDraft}
            durationValueInput={durationValueInput}
            durationUnit={durationUnit}
            availabilitySlots={availabilitySlots}
            existingPhotoUrls={existingProposalPhotoUrls}
            newPhotos={newPhotos}
            photosCount={photosCount}
            pricing={pricing}
            maxDescriptionLength={maxDescriptionLength}
            maxPhotos={maxPhotos}
            canSubmit={canSubmitProposal}
            onOpenChange={(open) => {
              if (!open) closeProposalComposer();
            }}
            onPriceInputChange={setPriceInput}
            onDescriptionDraftChange={setDescriptionDraft}
            onDurationValueInputChange={setDurationValueInput}
            onDurationUnitChange={setDurationUnit}
            onAvailabilitySlotChange={updateAvailabilitySlot}
            onAvailabilitySlotAdd={addAvailabilitySlot}
            onAvailabilitySlotRemove={removeAvailabilitySlot}
            onPhotoAdd={addPhotos}
            onExistingPhotoRemove={removeExistingPhoto}
            onNewPhotoRemove={removeNewPhoto}
            onSubmit={async () => {
              await submitProposal();
            }}
          />
        </CardContent>
      </Card>

      <JobQuestionsFeed serviceRequestId={job.id} />
      {hasLatestProposal && (
        <ProviderProposalSummaryCard
          job={job}
          canEdit={canEditProposal}
          onEdit={() => openProposalComposer({ mode: "edit" })}
        />
      )}

      {!hasActiveProposal && (
        <JobDetailFloatingActions
          isInsideSheet={isInsideSheet}
          onAskQuestion={() => openComposer()}
          onOpenProposalComposer={() => openProposalComposer()}
        />
      )}
    </div>
  );
}
