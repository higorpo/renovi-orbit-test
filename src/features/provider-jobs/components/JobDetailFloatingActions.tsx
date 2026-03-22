import { CircleDollarSign, HelpCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface JobDetailFloatingActionsProps {
  isInsideSheet: boolean;
  onAskQuestion: () => void;
  onOpenProposalComposer: () => void;
}

export function JobDetailFloatingActions({
  isInsideSheet,
  onAskQuestion,
  onOpenProposalComposer,
}: JobDetailFloatingActionsProps) {
  return (
    <>
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
          onClick={onOpenProposalComposer}
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
        <Button type="button" variant="outline" className="w-full gap-2" onClick={onAskQuestion}>
          <HelpCircle className="h-4 w-4" aria-hidden />
          Quero fazer uma pergunta
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2"
          onClick={onOpenProposalComposer}
        >
          <Send className="h-4 w-4" aria-hidden />
          Estou pronto para enviar um orçamento
        </Button>
      </div>
    </>
  );
}
