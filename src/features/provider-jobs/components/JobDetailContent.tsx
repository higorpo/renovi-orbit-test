import {
  AlertTriangle,
  CheckCircle,
  Clock,
  CircleDollarSign,
  HelpCircle,
  MapPin,
  MessageSquare,
  Package,
  Send,
  Tag,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getServiceCardStyle } from "@/features/request-quote";
import { formatDistance } from "@/lib/formatDistance";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { cn } from "@/lib/utils";
import { useProviderJobQuestionComposer } from "../hooks/useProviderJobQuestionComposer";
import { useProviderProposalComposer } from "../hooks/useProviderProposalComposer";
import { MAX_PROPOSALS_PER_REQUEST } from "../types/provider-jobs.types";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import {
  mapSuggestedEquipmentToPt,
  mapSuggestedMaterialsToPt,
} from "../utils/suggestedItemsMapper";
import { FormResponsesSummary } from "./FormResponsesSummary";
import { JobDetailMetadataBadges } from "./JobDetailMetadataBadges";
import { JobDetailPhotoGallery } from "./JobDetailPhotoGallery";
import { JobQuestionComposerDialog } from "./JobQuestionComposerDialog";
import { JobQuestionPromptCard } from "./JobQuestionPromptCard";
import { JobQuestionsFeed } from "./JobQuestionsFeed";
import { ProviderProposalComposerDialog } from "./ProviderProposalComposerDialog";
import { SuggestedItemsInfo } from "./SuggestedItemsInfo";
import { URGENCY_CONFIG } from "./JobDetail.constants";

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
  const {
    isOpen: isProposalOpen,
    isSubmitting: isProposalSubmitting,
    isPricingLoading,
    priceInput,
    descriptionDraft,
    photos,
    pricing,
    maxDescriptionLength,
    maxPhotos,
    openComposer: openProposalComposer,
    closeComposer: closeProposalComposer,
    setPriceInput,
    setDescriptionDraft,
    addPhotos,
    removePhoto,
    submitProposal,
  } = useProviderProposalComposer(job.id);

  const urgencyConfig = job.urgency ? URGENCY_CONFIG[job.urgency] : null;

  return (
    <div className="space-y-4 pb-24 md:pb-28">
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
              <Badge variant={urgencyConfig.variant}>
                <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
                {urgencyConfig.label}
              </Badge>
            )}
            {job.exact_area_match && (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-200 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400"
              >
                <CheckCircle className="h-3 w-3" aria-hidden />
                Na sua área
              </Badge>
            )}
            <Badge variant="secondary">
              <MessageSquare className="mr-1 h-3 w-3" aria-hidden />
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

          {job.description && (
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Descrição
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {job.description}
              </p>
            </div>
          )}

          <FormResponsesSummary
            formData={job.form_data}
            formSchema={job.form_schema}
          />

          {job.photos && job.photos.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Fotos ({job.photos.length})
              </h3>
              <div className="mt-2">
                <JobDetailPhotoGallery photos={job.photos} />
              </div>
            </div>
          )}

          {job.tags && job.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground">Tags</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {job.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    <Tag className="h-3 w-3" aria-hidden />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {suggestedEquipmentPt.length > 0 && (
            <div>
              <div className="flex items-center">
                <h3 className="text-sm font-semibold text-foreground">
                  Equipamentos que podem ser úteis
                </h3>
                <SuggestedItemsInfo ariaLabel="Mais informações sobre equipamentos sugeridos" />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestedEquipmentPt.map((eq) => (
                  <span
                    key={eq}
                    className="inline-flex items-center gap-1 rounded-full border bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                  >
                    <Wrench className="h-3 w-3" aria-hidden />
                    {eq}
                  </span>
                ))}
              </div>
            </div>
          )}

          {suggestedMaterialsPt.length > 0 && (
            <div>
              <div className="flex items-center">
                <h3 className="text-sm font-semibold text-foreground">
                  Materiais que podem ser úteis
                </h3>
                <SuggestedItemsInfo ariaLabel="Mais informações sobre materiais sugeridos" />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestedMaterialsPt.map((mat) => (
                  <span
                    key={mat}
                    className="inline-flex items-center gap-1 rounded-full border bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                  >
                    <Package className="h-3 w-3" aria-hidden />
                    {mat}
                  </span>
                ))}
              </div>
            </div>
          )}

          <JobQuestionPromptCard
            suggestedQuestions={suggestedQuestions}
            onAskQuestion={() => openComposer()}
            onUseSuggestedQuestion={(question) =>
              openComposer({ prefilledQuestion: question })
            }
          />

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

          <ProviderProposalComposerDialog
            open={isProposalOpen}
            isSubmitting={isProposalSubmitting}
            isPricingLoading={isPricingLoading}
            priceInput={priceInput}
            descriptionDraft={descriptionDraft}
            photos={photos}
            pricing={pricing}
            maxDescriptionLength={maxDescriptionLength}
            maxPhotos={maxPhotos}
            onOpenChange={(open) => {
              if (!open) closeProposalComposer();
            }}
            onPriceInputChange={setPriceInput}
            onDescriptionDraftChange={setDescriptionDraft}
            onPhotoAdd={addPhotos}
            onPhotoRemove={removePhoto}
            onSubmit={async () => {
              await submitProposal();
            }}
          />
        </CardContent>
      </Card>

      <JobQuestionsFeed serviceRequestId={job.id} />

      <div
        className={cn(
          "fixed right-4 z-40 flex items-center gap-2 md:hidden",
          isInsideSheet
            ? "bottom-[calc(env(safe-area-inset-bottom)+1rem)]"
            : "bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]",
        )}
      >
        <span className="rounded-full border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
          Fazer orçamento &gt;
        </span>
        <Button
          type="button"
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          aria-label="Fazer orçamento"
          onClick={() => openProposalComposer()}
        >
          <CircleDollarSign className="h-6 w-6" aria-hidden />
        </Button>
      </div>

      <div
        className={cn(
          "fixed bottom-5 z-40 hidden rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 md:grid md:grid-cols-2 md:gap-3",
          isInsideSheet
            ? "right-4 w-[calc(100%-2rem)] sm:w-[calc(36rem-2rem)] md:w-[calc(42rem-2rem)] lg:w-[calc(48rem-2rem)]"
            : "left-1/2 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2",
        )}
      >
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => openComposer()}
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
          Quero fazer uma pergunta
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2"
          onClick={() => openProposalComposer()}
        >
          <Send className="h-4 w-4" aria-hidden />
          Estou pronto para enviar uma proposta
        </Button>
      </div>
    </div>
  );
}
