import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form } from "@/components/ui/form";
import { useServiceRescheduleMutations } from "../hooks/useServiceRescheduleMutations";
import { useRescheduleRequestDetail } from "../hooks/useRescheduleRequestDetail";
import {
  confirmRescheduleFormSchema,
  type ConfirmRescheduleFormValues,
} from "../types/serviceReschedule.forms";
import { formatRescheduleSlot } from "../utils/formatRescheduleSlot";

export interface AcceptRescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rescheduleRequestId: string | null;
  onSuccess?: () => void;
}

export function AcceptRescheduleDialog({
  open,
  onOpenChange,
  rescheduleRequestId,
  onSuccess,
}: AcceptRescheduleDialogProps) {
  const { snapshot, isLoading } = useRescheduleRequestDetail(rescheduleRequestId, open);
  const { acceptReschedule } = useServiceRescheduleMutations();
  const form = useForm<ConfirmRescheduleFormValues>({
    resolver: zodResolver(confirmRescheduleFormSchema),
    defaultValues: {},
  });

  const proposedSlotLabel = formatRescheduleSlot(snapshot?.activeRequest?.proposed_slot);

  const onSubmit = form.handleSubmit(async () => {
    if (!rescheduleRequestId) return;

    try {
      await acceptReschedule.mutateAsync({ rescheduleRequestId });
      toast.success("Reagendamento confirmado.");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao confirmar reagendamento.");
    }
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <Form {...form}>
          <form id="accept-reschedule-form" onSubmit={onSubmit}>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar nova data?</AlertDialogTitle>
              <AlertDialogDescription>
                {isLoading
                  ? "Carregando detalhes da proposta…"
                  : proposedSlotLabel
                    ? `A nova data será ${proposedSlotLabel}. A cobrança seguirá as regras do seu pagamento atual.`
                    : "Confirme para aplicar a nova data proposta pelo prestador."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={acceptReschedule.isPending}>
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                form="accept-reschedule-form"
                disabled={acceptReschedule.isPending || isLoading || !rescheduleRequestId}
              >
                {acceptReschedule.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Confirmando…
                  </>
                ) : (
                  "Confirmar nova data"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface CancelRescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rescheduleRequestId: string | null;
  onSuccess?: () => void;
}

export function CancelRescheduleDialog({
  open,
  onOpenChange,
  rescheduleRequestId,
  onSuccess,
}: CancelRescheduleDialogProps) {
  const { cancelReschedule } = useServiceRescheduleMutations();
  const form = useForm<ConfirmRescheduleFormValues>({
    resolver: zodResolver(confirmRescheduleFormSchema),
    defaultValues: {},
  });

  const onSubmit = form.handleSubmit(async () => {
    if (!rescheduleRequestId) return;

    try {
      await cancelReschedule.mutateAsync({ rescheduleRequestId });
      toast.success("Solicitação de reagendamento cancelada.");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao cancelar solicitação.");
    }
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <Form {...form}>
          <form id="cancel-reschedule-form" onSubmit={onSubmit}>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar solicitação de reagendamento?</AlertDialogTitle>
              <AlertDialogDescription>
                A data original do serviço permanece válida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={cancelReschedule.isPending}>
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                form="cancel-reschedule-form"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={cancelReschedule.isPending || !rescheduleRequestId}
              >
                {cancelReschedule.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Cancelando…
                  </>
                ) : (
                  "Cancelar solicitação"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface RequestAdjustmentRescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rescheduleRequestId: string | null;
  onSuccess?: () => void;
}

export function RequestAdjustmentRescheduleDialog({
  open,
  onOpenChange,
  rescheduleRequestId,
  onSuccess,
}: RequestAdjustmentRescheduleDialogProps) {
  const { requestAdjustment } = useServiceRescheduleMutations();
  const form = useForm<ConfirmRescheduleFormValues>({
    resolver: zodResolver(confirmRescheduleFormSchema),
    defaultValues: {},
  });

  const onSubmit = form.handleSubmit(async () => {
    if (!rescheduleRequestId) return;

    try {
      await requestAdjustment.mutateAsync({ rescheduleRequestId });
      toast.success("Pedido de ajuste enviado.");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao pedir ajuste.");
    }
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <Form {...form}>
          <form id="adjust-reschedule-form" onSubmit={onSubmit}>
            <AlertDialogHeader>
              <AlertDialogTitle>Pedir ajuste na data?</AlertDialogTitle>
              <AlertDialogDescription>
                O prestador será notificado para enviar outra proposta. Você pode continuar conversando
                pelo chat.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={requestAdjustment.isPending}>
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                form="adjust-reschedule-form"
                disabled={requestAdjustment.isPending || !rescheduleRequestId}
              >
                {requestAdjustment.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Enviando…
                  </>
                ) : (
                  "Pedir ajuste"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
