import { useMemo, useRef, type ReactNode } from "react";
import { FileQuestion, Wrench, Package } from "lucide-react";
import { useParams } from "react-router";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth";
import { ReceivedBudgetDetailsSheet } from "@/features/negotiation-proposals";
import { ManualPaymentFailureStatus } from "@/features/payments";
import { ServiceRequestConversationList } from "@/features/chats";
import type { FormSchema } from "@/features/dynamic-form";
import { useService } from "../hooks/useService";
import {
  mapSuggestedEquipmentToPt,
  mapSuggestedMaterialsToPt,
} from "../utils/suggestedItemsMapper";
import { useServiceRequestBudgetSheet } from "../hooks/useServiceRequestBudgetSheet";
import { useProviderServiceRequestChat } from "../hooks/useProviderServiceRequestChat";
import { useServiceDetailChatNavigation } from "../hooks/useServiceDetailChatNavigation";
import { useRecordProviderOpportunityView } from "../hooks/useRecordProviderOpportunityView";
import { useServiceDetailNextStep } from "../hooks/useServiceDetailNextStep";
import { useContainerMinWidth } from "../hooks/useContainerMinWidth";
import {
  SERVICE_DETAIL_PAGE_SHELL_CLASS,
  SERVICE_DETAIL_WIDE_LAYOUT_MIN_WIDTH_PX,
} from "../constants/serviceDetail.constants";
import { ServiceContractedSection } from "./ServiceContractedSection";
import { ServiceDetailNextStepOverlays } from "./ServiceDetailNextStepOverlays";
import { ServiceNextStepCard } from "./ServiceNextStepCard";
import { ClientServiceJourneySection } from "./ClientServiceJourneySection";
import { ServiceSupportHelpCard } from "./ServiceSupportHelpCard";
import { ServiceProviderLocationSection } from "./ServiceProviderLocationSection";
import { ServiceDetailFloatingActions } from "./ServiceDetailFloatingActions";
import { ServiceDetailHeader } from "./ServiceDetailHeader";
import { ServiceProviderProposalRejectionAlert } from "./ServiceProviderProposalRejectionAlert";
import { ServiceProviderProposalSection } from "./ServiceProviderProposalSection";
import { ServiceDetailSkeleton } from "./ServiceDetailSkeleton";
import { ServiceDetailSection } from "./ServiceDetailSection";
import { FormResponsesSummary } from "./FormResponsesSummary";
import { ServicePhotoGallery } from "./ServicePhotoGallery";
import { SuggestedItemsInfo } from "./SuggestedItemsInfo";
import {
  ServiceDetailNarrowStack,
  ServiceDetailWideLayout,
} from "./ServiceDetailLayout";

const suggestedItemClassName =
  "inline-flex items-center gap-1.5 rounded-sm border border-border bg-canvas-soft px-2.5 py-1 text-xs text-body";

interface ServiceDetailPageProps {
  serviceRequestId?: string;
  isInsideSheet?: boolean;
}

function renderIf(condition: boolean, node: ReactNode): ReactNode {
  return condition ? node : null;
}

export function ServiceDetailPage({
  serviceRequestId: serviceRequestIdProp,
  isInsideSheet = false,
}: ServiceDetailPageProps = {}) {
  const { id: routeId } = useParams<{ id: string }>();
  const id = serviceRequestIdProp ?? routeId;
  const { profile } = useAuth();
  useRecordProviderOpportunityView(id);
  const { data: model, isLoading, isError, refetch } = useService(id);
  const {
    budgetSheetOpen,
    setBudgetSheetOpen,
    selectedServiceRequestId,
    selectedBudgetSheetMode,
    openBudgetSheet,
  } = useServiceRequestBudgetSheet();

  const isClient = profile?.role === "client";
  const isProvider = profile?.role === "provider";

  const { data: providerChat } = useProviderServiceRequestChat(isProvider ? id : undefined);
  const { openChat, isOpeningChat } = useServiceDetailChatNavigation({
    serviceRequestId: id ?? "",
    existingChatId: providerChat?.chatId ?? null,
  });

  const nextStep = useServiceDetailNextStep({
    model,
    role: profile?.role,
    openBudgetSheet,
    openProviderChat: openChat,
    isOpeningProviderChat: isOpeningChat,
    onCompletionSuccess: () => void refetch(),
  });

  const suggestedEquipmentPt = useMemo(
    () => mapSuggestedEquipmentToPt(model?.suggestedEquipment ?? null),
    [model?.suggestedEquipment],
  );
  const suggestedMaterialsPt = useMemo(
    () => mapSuggestedMaterialsToPt(model?.suggestedMaterials ?? null),
    [model?.suggestedMaterials],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const isWideLayout = useContainerMinWidth(
    containerRef,
    SERVICE_DETAIL_WIDE_LAYOUT_MIN_WIDTH_PX,
  );

  const pageClassName = cn(
    SERVICE_DETAIL_PAGE_SHELL_CLASS,
    isInsideSheet ? "px-0 py-0" : null,
    isProvider ? "pb-24" : "pb-6",
    isWideLayout && "pb-6",
  );

  if (isLoading) {
    return (
      <div ref={containerRef} className={pageClassName}>
        <ServiceDetailSkeleton isWideLayout={isWideLayout} />
      </div>
    );
  }

  if (isError) {
    return (
      <div ref={containerRef} className={pageClassName}>
        <ErrorState
          title="Não foi possível carregar este serviço"
          description="Verifique sua conexão e tente novamente. Se o problema persistir, entre em contato com o suporte."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!model) {
    return (
      <div ref={containerRef} className={pageClassName}>
        <EmptyState
          icon={FileQuestion}
          title="Serviço não encontrado"
          description="Este serviço não existe ou você não tem permissão para visualizá-lo."
          ariaLabel="Serviço não encontrado"
        />
      </div>
    );
  }

  const showClientNegotiationChats =
    isClient && model.listPhase === "negotiation" && !model.contracted;

  const alerts = (
    <>
      {isProvider ? (
        <ServiceProviderProposalRejectionAlert serviceRequestId={model.id} />
      ) : null}
      {isClient && model.contracted ? (
        <ManualPaymentFailureStatus contractedServiceId={model.contracted.id} />
      ) : null}
    </>
  );

  const header = (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1">
      <ServiceDetailHeader
        model={model}
        isClient={isClient}
        isProvider={isProvider}
        onOpenBudgetSheet={openBudgetSheet}
        onMutated={() => void refetch()}
      />
    </article>
  );

  const description = renderIf(
    Boolean(model.description),
    <ServiceDetailSection title="Descrição do serviço">
      <p className="whitespace-pre-wrap text-caption leading-relaxed text-body">
        {model.description}
      </p>
    </ServiceDetailSection>,
  );

  const form = (
    <FormResponsesSummary
      formData={model.formData}
      formSchema={model.formSchema as FormSchema | null}
    />
  );

  const photos = renderIf(
    model.photoPaths.length > 0,
    <ServiceDetailSection
      title={`Fotos (${model.photoPaths.length})`}
      description="Toque para ampliar"
    >
      <ServicePhotoGallery photos={model.photoPaths} />
    </ServiceDetailSection>,
  );

  const equipment = renderIf(
    isProvider && suggestedEquipmentPt.length > 0,
    <ServiceDetailSection
      title="Equipamentos que podem ser úteis"
      titleAccessory={
        <SuggestedItemsInfo ariaLabel="Mais informações sobre equipamentos sugeridos" />
      }
    >
      <div className="flex flex-wrap gap-2">
        {suggestedEquipmentPt.map((eq) => (
          <span key={eq} className={suggestedItemClassName}>
            <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            {eq}
          </span>
        ))}
      </div>
    </ServiceDetailSection>,
  );

  const materials = renderIf(
    isProvider && suggestedMaterialsPt.length > 0,
    <ServiceDetailSection
      title="Materiais que podem ser úteis"
      titleAccessory={
        <SuggestedItemsInfo ariaLabel="Mais informações sobre materiais sugeridos" />
      }
    >
      <div className="flex flex-wrap gap-2">
        {suggestedMaterialsPt.map((mat) => (
          <span key={mat} className={suggestedItemClassName}>
            <Package className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            {mat}
          </span>
        ))}
      </div>
    </ServiceDetailSection>,
  );

  const nextStepCard = renderIf(
    Boolean(nextStep.step),
    nextStep.step ? (
      <ServiceNextStepCard
        step={nextStep.step}
        onAction={nextStep.handleAction}
        disabled={nextStep.actionDisabled}
      />
    ) : null,
  );

  const contracted = renderIf(
    Boolean(model.contracted),
    model.contracted ? (
      <ServiceContractedSection
        contracted={model.contracted}
        viewerRole={isClient ? "client" : "provider"}
      />
    ) : null,
  );

  const location = renderIf(
    isProvider && Boolean(model.contracted),
    <ServiceProviderLocationSection address={model.address} />,
  );

  const proposal = renderIf(
    isProvider,
    <ServiceProviderProposalSection serviceRequestId={model.id} />,
  );

  const conversations = renderIf(
    showClientNegotiationChats,
    <ServiceDetailSection
      title="Conversas"
      description="Negociações deste pedido com prestadores."
    >
      <ServiceRequestConversationList serviceRequestId={model.id} />
    </ServiceDetailSection>,
  );

  const journey = renderIf(
    isClient,
    <ClientServiceJourneySection
      serviceRequestId={model.id}
      ratingOptional={model.contracted?.status === "COMPLETED"}
    />,
  );

  const support = <ServiceSupportHelpCard />;

  const mainColumn = (
    <>
      {header}
      {description}
      {form}
      {photos}
      {equipment}
      {materials}
    </>
  );

  // Array keeps the aside :empty when every slot is null (no Fragment whitespace nodes).
  const asideColumn = [
    nextStepCard,
    contracted,
    location,
    proposal,
    conversations,
    journey,
  ];

  return (
    <div ref={containerRef} className={pageClassName} data-testid="service-detail-page">
      {isWideLayout ? (
        <ServiceDetailWideLayout
          alerts={alerts}
          main={mainColumn}
          aside={asideColumn}
          support={support}
        />
      ) : (
        <ServiceDetailNarrowStack>
          {alerts}
          {header}
          {description}
          {nextStepCard}
          {contracted}
          {location}
          {proposal}
          {conversations}
          {form}
          {photos}
          {equipment}
          {materials}
          {journey}
          {support}
        </ServiceDetailNarrowStack>
      )}

      {isProvider ? (
        <ServiceDetailFloatingActions
          hasExistingChat={Boolean(providerChat?.chatId)}
          isInsideSheet={isInsideSheet}
          isOpeningChat={isOpeningChat}
          onOpenChat={openChat}
        />
      ) : null}

      {isClient ? (
        <ReceivedBudgetDetailsSheet
          open={budgetSheetOpen}
          serviceRequestId={selectedServiceRequestId}
          sheetMode={selectedBudgetSheetMode}
          onOpenChange={(next) => {
            if (!next) setBudgetSheetOpen(false);
          }}
        />
      ) : null}

      <ServiceDetailNextStepOverlays
        model={model}
        role={profile?.role}
        step={nextStep.step}
        nextStep={nextStep}
      />
    </div>
  );
}
