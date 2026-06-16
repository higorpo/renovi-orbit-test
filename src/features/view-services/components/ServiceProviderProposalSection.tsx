import { useQueryClient } from "@tanstack/react-query";
import {
  canEditServiceRequestProposal,
  LATEST_PROVIDER_PROPOSAL_QUERY_KEY,
  ProposalComposerShellDialog,
  ServiceRequestProposalSummaryCard,
  ServiceRequestProposalSummaryCardSkeleton,
  useLatestProviderProposal,
  useProposalPhotoUrls,
  useServiceRequestProposalComposer,
} from "@/features/negotiation-proposals";
import { SERVICE_DETAIL_QUERY_KEY } from "../constants/queryKeys";

interface ServiceProviderProposalSectionProps {
  serviceRequestId: string;
}

export function ServiceProviderProposalSection({
  serviceRequestId,
}: ServiceProviderProposalSectionProps) {
  const queryClient = useQueryClient();
  const { data: proposal, isLoading } = useLatestProviderProposal(serviceRequestId);

  const proposalComposer = useServiceRequestProposalComposer({
    serviceRequestId,
    existingProposal: proposal?.draft ?? null,
    onSubmitSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [LATEST_PROVIDER_PROPOSAL_QUERY_KEY, serviceRequestId],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: [...SERVICE_DETAIL_QUERY_KEY, serviceRequestId],
          refetchType: "active",
        }),
      ]);
    },
  });

  const { urls: existingProposalPhotoUrls } = useProposalPhotoUrls(
    proposalComposer.existingPhotoPaths,
  );

  if (isLoading) {
    return <ServiceRequestProposalSummaryCardSkeleton />;
  }

  if (!proposal) {
    return null;
  }

  const canEdit = canEditServiceRequestProposal(proposal.summary.status);

  return (
    <>
      <ServiceRequestProposalSummaryCard
        summary={proposal.summary}
        canEdit={canEdit}
        headingSize="section"
        onEdit={() => proposalComposer.openComposer({ mode: "edit" })}
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
    </>
  );
}
