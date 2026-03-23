import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CircleDollarSign,
  FileText,
  MessageSquareQuote,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import {
  withdrawProviderProposal,
  type ProviderProposalHistoryItem,
} from "../api/providerProposals.api";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import { useProviderProposalHistory } from "../hooks/useProviderProposalHistory";
import { useProviderProposalPhotoUrls } from "../hooks/useProviderProposalPhotoUrls";
import { ProviderProposalPhotosGrid } from "./ProviderProposalPhotosGrid";
import { ProviderProposalHistoryAccordion } from "./ProviderProposalHistoryAccordion";
import { ProviderProposalDetailsDialog } from "./ProviderProposalDetailsDialog";
import {
  formatProposalCurrency,
  translateProposalStatus,
} from "./providerProposalFormatters";

interface ProviderProposalSummaryCardProps {
  job: ProviderJobItem;
  canEdit: boolean;
  onEdit: () => void;
}

export function ProviderProposalSummaryCard({
  job,
  canEdit,
  onEdit,
}: ProviderProposalSummaryCardProps) {
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] =
    useState<ProviderProposalHistoryItem | null>(null);
  const [isWithdrawConfirmOpen, setIsWithdrawConfirmOpen] = useState(false);
  const { urls, isLoading } = useProviderProposalPhotoUrls(job.provider_proposal_photos);
  const {
    items: proposalHistory,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
  } = useProviderProposalHistory(job.id, historyOpen);
  const withdrawMutation = useMutation({
    mutationFn: async () => withdrawProviderProposal(job.id),
    onSuccess: async ({ success, error }) => {
      if (error || !success) {
        toast.error(error ?? "Nao foi possivel retirar o orçamento.");
        return;
      }
      toast.success("Orçamento retirado com sucesso.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["provider-job", job.id] }),
        queryClient.invalidateQueries({ queryKey: ["provider-proposals-history", job.id] }),
      ]);
      setIsWithdrawConfirmOpen(false);
    },
    onError: () => {
      toast.error("Nao foi possivel retirar o orçamento.");
    },
  });
  if (!job.provider_proposal_id) return null;

  const proposalStatus = translateProposalStatus(job.provider_proposal_status);
  const canWithdrawProposal =
    canEdit &&
    (job.provider_proposal_status ?? "").toLowerCase() !== "rejected";
  const summaryTitle =
    job.is_latest_provider_proposal === false
      ? "Detalhes do orçamento"
      : "Seu orçamento mais recente enviado";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="w-full text-base font-semibold leading-tight text-foreground sm:w-auto">
            {summaryTitle}
          </h3>
          {canEdit && (
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
              <Button type="button" size="sm" variant="outline" onClick={onEdit} className="w-full sm:w-auto">
                Editar orçamento
              </Button>
              {canWithdrawProposal && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => setIsWithdrawConfirmOpen(true)}
                >
                  Retirar orçamento
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 !pt-0">
        <div className="grid gap-2 sm:grid-cols-2">
          {typeof job.provider_proposed_amount === "number" && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
                Valor informado
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatProposalCurrency(job.provider_proposed_amount)}
              </p>
            </div>
          )}

          {typeof job.provider_tax_amount === "number" && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Percent className="h-3.5 w-3.5" aria-hidden />
                Taxa da plataforma
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatProposalCurrency(job.provider_tax_amount)}
                {typeof job.provider_tax_rate === "number"
                  ? ` (${(job.provider_tax_rate * 100).toFixed(0)}%)`
                  : ""}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Status do orçamento</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {proposalStatus}
          </p>
        </div>

        {job.provider_proposal_description && (
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              Descrição do orçamento
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {job.provider_proposal_description}
            </p>
          </div>
        )}

        {(job.provider_proposal_status ?? "").toLowerCase() === "rejected" &&
          job.provider_proposal_client_rejection_response?.trim() && (
            <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MessageSquareQuote className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Resposta do cliente sobre a rejeição
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                {job.provider_proposal_client_rejection_response.trim()}
              </p>
            </div>
          )}

        <ProviderProposalPhotosGrid
          isLoading={isLoading}
          urls={urls}
          fallbackPhotos={job.provider_proposal_photos}
        />

        <ProviderProposalHistoryAccordion
          historyOpen={historyOpen}
          proposalHistory={proposalHistory}
          isHistoryLoading={isHistoryLoading}
          isHistoryError={isHistoryError}
          onHistoryOpenChange={setHistoryOpen}
          onProposalSelect={setSelectedProposal}
        />

        <ProviderProposalDetailsDialog
          proposal={selectedProposal}
          onOpenChange={(open) => {
            if (!open) setSelectedProposal(null);
          }}
        />
      </CardContent>

      <AlertDialog
        open={isWithdrawConfirmOpen}
        onOpenChange={(open) => {
          if (!withdrawMutation.isPending) setIsWithdrawConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja retirar este orçamento? Essa acao vai marcar o
              orçamento atual como retirado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdrawMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void withdrawMutation.mutateAsync();
              }}
              disabled={withdrawMutation.isPending}
            >
              {withdrawMutation.isPending ? "Retirando..." : "Confirmar retirada"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
