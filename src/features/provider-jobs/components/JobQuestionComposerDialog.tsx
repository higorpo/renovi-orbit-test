import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, MessageCircleQuestion, X } from "lucide-react";
import { z } from "zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";

interface JobQuestionComposerDialogProps {
  open: boolean;
  questionDraft: string;
  isSubmitting: boolean;
  maxQuestionLength: number;
  onOpenChange: (open: boolean) => void;
  onQuestionDraftChange: (value: string) => void;
  onSubmit: () => Promise<void>;
}

interface JobQuestionFormValues {
  question: string;
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
  const questionSchema = useMemo(
    () =>
      z.object({
        question: z
          .string()
          .trim()
          .min(1, "Escreva uma pergunta antes de enviar.")
          .max(
            maxQuestionLength,
            `A pergunta deve ter no máximo ${maxQuestionLength} caracteres.`,
          ),
      }),
    [maxQuestionLength],
  );

  const form = useForm<JobQuestionFormValues>({
    mode: "onChange",
    resolver: zodResolver(questionSchema),
    defaultValues: {
      question: questionDraft,
    },
  });

  useEffect(() => {
    form.reset({ question: questionDraft });
  }, [form, questionDraft]);

  const questionValue = form.watch("question", "");
  const charactersUsed = questionValue.length;
  const isOverLimit = charactersUsed > maxQuestionLength;
  const hasRequiredError = Boolean(form.formState.errors.question);

  const handleValidSubmit = async (values: JobQuestionFormValues) => {
    onQuestionDraftChange(values.question);
    await onSubmit();
  };

  const { contentRef, scheduleSync } = useMobileDialogViewport(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 [&>button]:hidden",
          "max-sm:inset-x-0 max-sm:bottom-auto max-sm:left-0 max-sm:right-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0",
          "sm:w-full sm:max-w-lg sm:rounded-lg sm:border sm:p-6",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col sm:h-auto">
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:border-b-0 sm:px-0 sm:py-0">
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
        </DialogHeader>

        <div className="min-h-0 flex-1 touch-pan-y space-y-2 overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-0 sm:py-0">
          <DialogDescription className="sm:pb-2">
            Escreva sua pergunta com clareza. O cliente poderá responder antes de
            você enviar o orçamento.
          </DialogDescription>
          <Form {...form}>
            <form
              id="job-question-composer-form"
              onSubmit={form.handleSubmit(handleValidSubmit)}
              className="space-y-2"
            >
              <FormField
                control={form.control}
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        autoFocus
                        {...field}
                        onChange={(event) => {
                          field.onChange(event.target.value);
                          onQuestionDraftChange(event.target.value);
                        }}
                        onFocus={() => {
                          scheduleSync();
                        }}
                        placeholder="Ex.: O local possui ponto de energia próximo da área do serviço?"
                        className="min-h-40 resize-y max-sm:min-h-32 max-sm:resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <p className="text-xs text-muted-foreground">
            Você pode enviar no máximo 3 perguntas para este pedido.
          </p>
          <p
            className={isOverLimit ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
          >
            {charactersUsed}/{maxQuestionLength} caracteres
          </p>
        </div>

        <DialogFooter className="relative z-10 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:flex-1 sm:[&>button]:flex-none">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="job-question-composer-form"
            disabled={isSubmitting || isOverLimit || hasRequiredError}
          >
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
