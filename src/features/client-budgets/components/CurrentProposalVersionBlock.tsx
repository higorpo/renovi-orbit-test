import { Clock, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatCurrency";
import { ProposalPhotosGrid, useProposalPhotoUrls } from "@/features/negotiation-proposals";
import type { ClientBudgetDetailProposal } from "../types/client-budgets.types";
import { BudgetStatusBadge } from "./BudgetStatusBadge";

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return null;
  }
}

interface CurrentProposalVersionBlockProps {
  proposal: ClientBudgetDetailProposal;
}

export function CurrentProposalVersionBlock({ proposal }: CurrentProposalVersionBlockProps) {
  const { urls, isLoading } = useProposalPhotoUrls(
    proposal.photos?.length ? proposal.photos : null,
  );
  const deadlineLabel = formatDeadline(proposal.client_response_deadline_at);
  const showDeadline =
    proposal.status === "submitted" && Boolean(deadlineLabel);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Versão atual
      </p>
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-semibold">{formatCurrency(proposal.proposed_amount)}</p>
          <BudgetStatusBadge status={proposal.status} />
        </div>

        {showDeadline ? (
          <div className="flex gap-2 rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">Prazo para responder</p>
              <p className="text-muted-foreground">
                Aprove ou recuse este orçamento até{" "}
                <span className="font-medium text-foreground">{deadlineLabel}</span>.
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Descrição do orçamento
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {proposal.proposal_description}
          </p>
        </div>

        <ProposalPhotosGrid
          isLoading={isLoading}
          urls={urls}
          fallbackPhotos={proposal.photos}
          heading="Fotos do orçamento"
          photoAltPrefix="Foto do orçamento"
        />
      </div>
    </div>
  );
}
