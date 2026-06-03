import { MessageSquareQuote } from "lucide-react";
import type { ProposalRevisionReason } from "../types/proposals.types";
import { getProposalRevisionReasonLabel } from "../utils/proposalRevisionReasonLabels";

export interface ProposalRevisionRequestNoticeProps {
  revisionReason: ProposalRevisionReason | null | undefined;
  revisionNotes?: string | null;
}

export function ProposalRevisionRequestNotice({
  revisionReason,
  revisionNotes,
}: ProposalRevisionRequestNoticeProps) {
  if (!revisionReason) return null;

  const trimmedNotes = revisionNotes?.trim();

  return (
    <div className="rounded-lg border border-amber-600/25 bg-amber-500/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageSquareQuote className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Revisão solicitada pelo cliente
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Categoria</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">
        {getProposalRevisionReasonLabel(revisionReason)}
      </p>
      {trimmedNotes ? (
        <>
          <p className="mt-3 text-xs text-muted-foreground">Motivo</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{trimmedNotes}</p>
        </>
      ) : null}
    </div>
  );
}
