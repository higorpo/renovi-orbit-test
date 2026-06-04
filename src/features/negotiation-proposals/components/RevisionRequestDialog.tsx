import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { MAX_PROPOSAL_REVISIONS } from "../constants/proposalRevisions";
import { useRequestProposalRevisionMutation } from "../hooks/useProposalClientMutations";
import type { ProposalRevisionReason } from "../types/proposals.types";
import { ProposalRevisionCounter } from "./ProposalRevisionCounter";
import { PROPOSAL_REVISION_REASON_OPTIONS } from "../utils/proposalRevisionReasonLabels";

const MAX_NOTES_LENGTH = 2000;

const revisionSchema = z.object({
  revisionReason: z.enum([
    "PRICE_TOO_HIGH",
    "REDUCE_SCOPE",
    "DATE_NOT_AVAILABLE",
    "CHANGE_TIMELINE",
    "CLARIFY_DETAILS",
    "OTHER",
  ] as const),
  revisionNotes: z
    .string()
    .max(MAX_NOTES_LENGTH, `As observações devem ter no máximo ${MAX_NOTES_LENGTH} caracteres.`),
});

type RevisionFormValues = z.infer<typeof revisionSchema>;

export interface RevisionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string | null;
  serviceRequestId: string | null;
  proposalId: string | null;
  revisionCount: number;
}

export function RevisionRequestDialog({
  open,
  onOpenChange,
  chatId,
  serviceRequestId,
  proposalId,
  revisionCount,
}: RevisionRequestDialogProps) {
  const revisionMutation = useRequestProposalRevisionMutation(chatId, serviceRequestId);
  const { contentRef, scheduleSync } = useMobileDialogViewport(open);
  const revisionLimitReached = revisionCount >= MAX_PROPOSAL_REVISIONS;

  const form = useForm<RevisionFormValues>({
    mode: "onChange",
    resolver: zodResolver(revisionSchema),
    defaultValues: {
      revisionReason: "CLARIFY_DETAILS",
      revisionNotes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ revisionReason: "CLARIFY_DETAILS", revisionNotes: "" });
    }
  }, [open, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (!proposalId || revisionLimitReached) return;

    revisionMutation.mutate(
      {
        proposalId,
        revisionReason: values.revisionReason as ProposalRevisionReason,
        revisionNotes: values.revisionNotes.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  const notesWatch = form.watch("revisionNotes") ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ShellDialogContent ref={contentRef}>
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-0 text-left sm:border-b-0 sm:px-0 sm:py-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base sm:text-lg">Pedir revisão</DialogTitle>
            <DialogClose asChild>
              <button type="button" aria-label="Fechar" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogClose>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Informe o que precisa mudar na proposta. O prestador poderá enviar uma nova versão.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="revision-request-form" onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain sm:px-0">
                <ProposalRevisionCounter revisionCount={revisionCount} />

                <FormField
                  control={form.control}
                  name="revisionReason"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="revision-reason">Motivo</Label>
                      <FormControl>
                        <select
                          id="revision-reason"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          {...field}
                          onFocus={scheduleSync}
                          disabled={revisionLimitReached}
                        >
                          {PROPOSAL_REVISION_REASON_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="revisionNotes"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="revision-notes">Observações (opcional)</Label>
                      <FormControl>
                        <Textarea
                          id="revision-notes"
                          {...field}
                          onFocus={scheduleSync}
                          disabled={revisionLimitReached}
                          className="min-h-28 resize-y max-sm:resize-none"
                          placeholder="Detalhe o que deve ser ajustado na proposta."
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        {notesWatch.length}/{MAX_NOTES_LENGTH} caracteres
                      </p>
                    </FormItem>
                  )}
                />
            </div>

            <DialogFooter className="relative z-10 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:flex-1 sm:[&>button]:flex-none">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={revisionMutation.isPending}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="revision-request-form"
                disabled={!proposalId || revisionMutation.isPending || revisionLimitReached}
              >
                {revisionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Enviando…
                  </>
                ) : (
                  "Solicitar revisão"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </ShellDialogContent>
    </Dialog>
  );
}
