import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { useServiceRescheduleMutations } from "../hooks/useServiceRescheduleMutations";
import {
  requestRescheduleFormSchema,
  type RequestRescheduleFormValues,
} from "../types/serviceReschedule.forms";

export interface RequestRescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractedServiceId: string;
  onSuccess?: (chatId: string | null) => void;
}

export function RequestRescheduleDialog({
  open,
  onOpenChange,
  contractedServiceId,
  onSuccess,
}: RequestRescheduleDialogProps) {
  const { contentRef, scheduleSync } = useMobileDialogViewport(open);
  const { requestReschedule } = useServiceRescheduleMutations();
  const form = useForm<RequestRescheduleFormValues>({
    mode: "onChange",
    resolver: zodResolver(requestRescheduleFormSchema),
    defaultValues: { note: "" },
  });

  useEffect(() => {
    if (open) form.reset({ note: "" });
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await requestReschedule.mutateAsync({
        contractedServiceId,
        requestNote: values.note.trim() || null,
      });

      toast.success("Solicitação de reagendamento enviada.");
      form.reset({ note: "" });
      onOpenChange(false);
      onSuccess?.(result.chat_id ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao solicitar reagendamento.");
    }
  });

  const noteWatch = form.watch("note") ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ShellDialogContent ref={contentRef}>
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-0 text-left sm:border-b-0 sm:px-0 sm:py-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base sm:text-lg">Solicitar reagendamento</DialogTitle>
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
          <DialogDescription className="text-sm text-muted-foreground">
            A data oficial do serviço só muda após o prestador propor e você confirmar a nova data.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="request-reschedule-form"
            onSubmit={onSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain [-webkit-overflow-scrolling:touch] sm:px-0 sm:py-0">
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="reschedule-note">Observação (opcional)</Label>
                    <FormControl>
                      <Textarea
                        id="reschedule-note"
                        {...field}
                        onFocus={scheduleSync}
                        maxLength={500}
                        placeholder="Explique o motivo ou preferências de horário."
                        rows={4}
                        className="min-h-28 resize-y max-sm:resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      {noteWatch.length}/500 caracteres
                    </p>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="relative z-10 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:mt-4 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:flex-1 sm:[&>button]:flex-none">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={requestReschedule.isPending}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                form="request-reschedule-form"
                disabled={requestReschedule.isPending}
              >
                {requestReschedule.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Enviando…
                  </>
                ) : (
                  "Solicitar reagendamento"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </ShellDialogContent>
    </Dialog>
  );
}
