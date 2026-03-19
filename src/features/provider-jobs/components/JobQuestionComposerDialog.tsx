import { Loader2, MessageCircleQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface JobQuestionComposerDialogProps {
  open: boolean;
  questionDraft: string;
  isSubmitting: boolean;
  maxQuestionLength: number;
  onOpenChange: (open: boolean) => void;
  onQuestionDraftChange: (value: string) => void;
  onSubmit: () => Promise<void>;
}

export function JobQuestionComposerDialog({
  open,
  questionDraft,
  isSubmitting,
  maxQuestionLength,
  onOpenChange,
  onQuestionDraftChange,
  onSubmit,
}: JobQuestionComposerDialogProps) {
  const charactersUsed = questionDraft.length;
  const isOverLimit = charactersUsed > maxQuestionLength;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen w-screen max-w-none rounded-none border-0 p-0 [&>button]:hidden sm:h-auto sm:w-full sm:max-w-lg sm:rounded-lg sm:border sm:p-6">
        <div className="flex h-full flex-col sm:h-auto">
        <DialogHeader className="shrink-0 border-b px-4 py-4 text-left sm:border-b-0 sm:px-0 sm:py-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2">
              <MessageCircleQuestion className="h-5 w-5 text-primary" aria-hidden />
              Enviar pergunta ao cliente
            </DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogClose>
          </div>
          <DialogDescription className="sm:pb-4">
            Escreva sua pergunta com clareza. O cliente poderá responder antes de
            você enviar a proposta.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 sm:px-0 sm:py-0">
          <Textarea
            autoFocus
            value={questionDraft}
            onChange={(event) => onQuestionDraftChange(event.target.value)}
            placeholder="Ex.: O local possui ponto de energia próximo da área do serviço?"
            className="min-h-40 resize-y"
          />
          <p className="text-xs text-muted-foreground">
            Você pode enviar no máximo 3 perguntas para este pedido.
          </p>
          <p
            className={isOverLimit ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
          >
            {charactersUsed}/{maxQuestionLength} caracteres
          </p>
        </div>

        <DialogFooter className="shrink-0 flex-row gap-2 border-t px-4 py-3 sm:border-t-0 sm:px-0 sm:py-0 [&>button]:flex-1 sm:[&>button]:flex-none">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={isSubmitting || isOverLimit}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Enviando...
              </>
            ) : (
              "Enviar pergunta"
            )}
          </Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
