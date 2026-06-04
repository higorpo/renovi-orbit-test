import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { applyContentModerationZodIssue } from "@/lib/contentModeration";
import { useRejectServiceRequestBudgetProposal } from "../hooks/useRejectServiceRequestBudgetProposal";

const MAX_REASON_LENGTH = 2000;

const rejectReasonSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Descreva o motivo da recusa.")
      .max(MAX_REASON_LENGTH, `O motivo deve ter no máximo ${MAX_REASON_LENGTH} caracteres.`),
  })
  .superRefine((data, context) => {
    applyContentModerationZodIssue(context, data.reason, ["reason"]);
  });

type RejectReasonFormValues = z.infer<typeof rejectReasonSchema>;

interface ServiceRequestBudgetRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceRequestId: string | null;
  proposalId: string | null;
}

export function ServiceRequestBudgetRejectDialog({
  open,
  onOpenChange,
  serviceRequestId,
  proposalId,
}: ServiceRequestBudgetRejectDialogProps) {
  const rejectMutation = useRejectServiceRequestBudgetProposal(serviceRequestId);
  const { contentRef, scheduleSync } = useMobileDialogViewport(open);
  const form = useForm<RejectReasonFormValues>({
    mode: "onChange",
    resolver: zodResolver(rejectReasonSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ reason: "" });
    }
  }, [open, form]);

  const reasonWatch = form.watch("reason") ?? "";

  const onSubmit = form.handleSubmit((values) => {
    if (!proposalId) return;
    rejectMutation.mutate(
      { proposalId, reason: values.reason.trim() },
      {
        onSuccess: () => {
          form.reset({ reason: "" });
          onOpenChange(false);
        },
      },
    );
  });

  const submitDisabled = !proposalId || rejectMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ShellDialogContent ref={contentRef} size="md">
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-0 text-left sm:border-b-0 sm:px-0 sm:py-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base sm:text-lg">Recusar orçamento</DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">
            Informe o motivo pelo qual você está recusando este orçamento. O prestador verá esta mensagem.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="service-request-budget-reject-form"
            onSubmit={onSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain [-webkit-overflow-scrolling:touch] sm:px-0 sm:py-0">
              <p className="text-sm text-muted-foreground">
                Explique ao prestador por que você está recusando este orçamento. Ele verá esta mensagem.
              </p>
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="service-request-budget-reject-reason">Motivo da recusa</Label>
                    <FormControl>
                      <Textarea
                        id="service-request-budget-reject-reason"
                        {...field}
                        placeholder="Ex.: valor acima do esperado, prazo incompatível..."
                        onFocus={scheduleSync}
                        className="min-h-32 resize-y max-sm:resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground">
                {reasonWatch.length}/{MAX_REASON_LENGTH}
              </p>
            </div>

            <DialogFooter className="relative z-10 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:flex-1 sm:[&>button]:flex-none">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="service-request-budget-reject-form" disabled={submitDisabled}>
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Enviando...
                  </>
                ) : (
                  "Enviar recusa"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </ShellDialogContent>
    </Dialog>
  );
}
