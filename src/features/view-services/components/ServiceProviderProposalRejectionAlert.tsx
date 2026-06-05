import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  isRejectedProposalStatus,
  useLatestProviderProposal,
} from "@/features/negotiation-proposals";

interface ServiceProviderProposalRejectionAlertProps {
  serviceRequestId: string;
}

export function ServiceProviderProposalRejectionAlert({
  serviceRequestId,
}: ServiceProviderProposalRejectionAlertProps) {
  const { data: proposal, isLoading } = useLatestProviderProposal(serviceRequestId);

  if (isLoading || !proposal) {
    return null;
  }

  if (!isRejectedProposalStatus(proposal.summary.status)) {
    return null;
  }

  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">Orçamento rejeitado pelo cliente</AlertTitle>
      <AlertDescription className="mt-2 space-y-1">
        <p className="whitespace-pre-wrap text-sm">
          {proposal.summary.clientRejectionResponse?.trim() ||
            "O cliente rejeitou o orçamento sem deixar um comentário."}
        </p>
      </AlertDescription>
    </Alert>
  );
}
