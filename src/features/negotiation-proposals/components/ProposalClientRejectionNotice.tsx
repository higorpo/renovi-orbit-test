import { MessageSquareQuote } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProposalClientRejectionNoticeProps {
  clientRejectionResponse: string | null | undefined;
  className?: string;
}

export function ProposalClientRejectionNotice({
  clientRejectionResponse,
  className,
}: ProposalClientRejectionNoticeProps) {
  const trimmedResponse = clientRejectionResponse?.trim();
  if (!trimmedResponse) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-destructive/25 bg-destructive/5 p-3",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageSquareQuote className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Resposta do cliente sobre a rejeição
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{trimmedResponse}</p>
    </div>
  );
}
