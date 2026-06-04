import { cn } from "@/lib/utils";
import { MAX_PROPOSAL_REVISIONS } from "../constants/proposalRevisions";

export interface ProposalRevisionCounterProps {
  revisionCount: number;
  maxRevisions?: number;
  className?: string;
}

export function ProposalRevisionCounter({
  revisionCount,
  maxRevisions = MAX_PROPOSAL_REVISIONS,
  className,
}: ProposalRevisionCounterProps) {
  const remaining = Math.max(0, maxRevisions - revisionCount);

  return (
    <p className={cn("text-sm text-muted-foreground", className)} role="status">
      Revisões solicitadas: <span className="font-medium text-foreground">{revisionCount}</span> de{" "}
      <span className="font-medium text-foreground">{maxRevisions}</span>
      {remaining === 0 ? (
        <span className="block text-destructive">Limite de revisões atingido.</span>
      ) : (
        <span className="block">
          Você ainda pode solicitar {remaining} {remaining === 1 ? "revisão" : "revisões"}.
        </span>
      )}
    </p>
  );
}
