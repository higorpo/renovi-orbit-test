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
  Image as ImageIcon,
  Eye,
  MessageSquareQuote,
  Percent,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  withdrawProviderProposal,
  type ProviderProposalHistoryItem,
} from "../api/providerProposals.api";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import { useProviderProposalHistory } from "../hooks/useProviderProposalHistory";
import { useProviderProposalPhotoUrls } from "../hooks/useProviderProposalPhotoUrls";

interface ProviderProposalSummaryCardProps {
  job: ProviderJobItem;
  canEdit: boolean;
  onEdit: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Data indisponível";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsedDate);
}

function translateProposalStatus(status: string | null): string {
  const normalized = (status ?? "submitted").toLowerCase();
  const mapping: Record<string, string> = {
    submitted: "Aguardando avaliação do cliente",
    accepted: "Aceita pelo cliente",
    rejected: "Rejeitada pelo cliente",
    withdrawn: "Proposta retirada",
  };
  return mapping[normalized] ?? "Aguardando avaliação do cliente";
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
  const { urls: selectedProposalPhotoUrls, isLoading: isSelectedPhotosLoading } =
    useProviderProposalPhotoUrls(selectedProposal?.photos ?? null);
  const withdrawMutation = useMutation({
    mutationFn: async () => withdrawProviderProposal(job.id),
    onSuccess: async ({ success, error }) => {
      if (error || !success) {
        toast.error(error ?? "Nao foi possivel retirar a proposta.");
        return;
      }
      toast.success("Proposta retirada com sucesso.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["provider-job", job.id] }),
        queryClient.invalidateQueries({ queryKey: ["provider-proposals-history", job.id] }),
      ]);
      setIsWithdrawConfirmOpen(false);
    },
    onError: () => {
      toast.error("Nao foi possivel retirar a proposta.");
    },
  });
  if (!job.provider_proposal_id) return null;

  const proposalStatus = translateProposalStatus(job.provider_proposal_status);
  const canWithdrawProposal =
    canEdit &&
    (job.provider_proposal_status ?? "").toLowerCase() !== "rejected";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="w-full text-base font-semibold leading-tight text-foreground sm:w-auto">
            Sua proposta mais recente enviada
          </h3>
          {canEdit && (
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
              <Button type="button" size="sm" variant="outline" onClick={onEdit} className="w-full sm:w-auto">
                Editar proposta
              </Button>
              {canWithdrawProposal && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => setIsWithdrawConfirmOpen(true)}
                >
                  Retirar proposta
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
                {formatCurrency(job.provider_proposed_amount)}
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
                {formatCurrency(job.provider_tax_amount)}
                {typeof job.provider_tax_rate === "number"
                  ? ` (${(job.provider_tax_rate * 100).toFixed(0)}%)`
                  : ""}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Status da proposta</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {proposalStatus}
          </p>
        </div>

        {job.provider_proposal_description && (
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              Descrição da proposta
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

        {(isLoading || urls.length > 0) && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" aria-hidden />
              Fotos da proposta
            </p>
            {isLoading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(job.provider_proposal_photos ?? []).slice(0, 4).map((_, index) => (
                  <div
                    key={index}
                    className="aspect-square animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {urls.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="aspect-square overflow-hidden rounded-lg border bg-muted"
                  >
                    <img
                      src={url}
                      alt={`Foto da proposta ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Accordion
          type="single"
          collapsible
          value={historyOpen ? "proposal-history" : ""}
          onValueChange={(value) => setHistoryOpen(value === "proposal-history")}
        >
          <AccordionItem value="proposal-history">
            <AccordionTrigger>Ver historico de propostas</AccordionTrigger>
            <AccordionContent>
              {isHistoryLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              )}

              {!isHistoryLoading && isHistoryError && (
                <p className="text-sm text-muted-foreground">
                  Nao foi possivel carregar o historico de propostas.
                </p>
              )}

              {!isHistoryLoading && !isHistoryError && proposalHistory.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma proposta encontrada para este trabalho.
                </p>
              )}

              {!isHistoryLoading && !isHistoryError && proposalHistory.length > 0 && (
                <div className="space-y-2">
                  {proposalHistory.map((proposal) => (
                    <div key={proposal.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(proposal.proposed_amount)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {proposal.proposal_description}
                          </p>
                          <p className="mt-2 text-xs font-medium text-foreground">
                            Status: {translateProposalStatus(proposal.status)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Ver detalhes da proposta"
                          onClick={() => setSelectedProposal(proposal)}
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Dialog
          open={Boolean(selectedProposal)}
          onOpenChange={(open) => {
            if (!open) setSelectedProposal(null);
          }}
        >
          <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
            <DialogHeader className="shrink-0">
              <DialogTitle>Detalhes da proposta</DialogTitle>
            </DialogHeader>

            {selectedProposal && (
              <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Valor cobrado</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(selectedProposal.proposed_amount)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {translateProposalStatus(selectedProposal.status)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Taxa da plataforma</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(selectedProposal.tax_amount)} (
                      {(selectedProposal.tax_rate * 100).toFixed(0)}%)
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Valor a receber</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(selectedProposal.final_amount)}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {selectedProposal.proposal_description}
                  </p>
                </div>

                {(selectedProposal.status ?? "").toLowerCase() === "rejected" &&
                  selectedProposal.client_rejection_response?.trim() && (
                    <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <MessageSquareQuote className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Resposta do cliente sobre a rejeição
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                        {selectedProposal.client_rejection_response.trim()}
                      </p>
                    </div>
                  )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Criada em</p>
                    <p className="mt-1 text-sm text-foreground">
                      {formatDateTime(selectedProposal.created_at)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Ultima edicao</p>
                    <p className="mt-1 text-sm text-foreground">
                      {formatDateTime(selectedProposal.updated_at)}
                    </p>
                  </div>
                </div>

                {(isSelectedPhotosLoading || selectedProposalPhotoUrls.length > 0) && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Fotos da proposta
                    </p>
                    {isSelectedPhotosLoading ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {(selectedProposal.photos ?? []).slice(0, 4).map((_, index) => (
                          <div
                            key={index}
                            className="aspect-square animate-pulse rounded-lg bg-muted"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {selectedProposalPhotoUrls.map((url, index) => (
                          <div
                            key={`${url}-${index}`}
                            className="aspect-square overflow-hidden rounded-lg border bg-muted"
                          >
                            <img
                              src={url}
                              alt={`Foto da proposta ${index + 1}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>

      <AlertDialog
        open={isWithdrawConfirmOpen}
        onOpenChange={(open) => {
          if (!withdrawMutation.isPending) setIsWithdrawConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja retirar esta proposta? Essa acao vai marcar a
              proposta atual como retirada.
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
