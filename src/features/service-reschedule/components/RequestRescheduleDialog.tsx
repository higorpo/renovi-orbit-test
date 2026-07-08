import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar reagendamento</DialogTitle>
          <DialogDescription>
            A data oficial do serviço só muda após o prestador propor e você confirmar a nova data.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="request-reschedule-form" onSubmit={onSubmit} className="space-y-4">
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
                      maxLength={500}
                      placeholder="Explique o motivo ou preferências de horário."
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={requestReschedule.isPending}
              >
                Voltar
              </Button>
              <Button type="submit" form="request-reschedule-form" disabled={requestReschedule.isPending}>
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
      </DialogContent>
    </Dialog>
  );
}
