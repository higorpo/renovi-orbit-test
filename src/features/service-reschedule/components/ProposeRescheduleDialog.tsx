import { useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addCalendarDaysIso,
  todayCalendarIso,
} from "@/features/view-services/utils/serviceCalendarDate";
import { useServiceRescheduleMutations } from "../hooks/useServiceRescheduleMutations";
import {
  proposeRescheduleFormSchema,
  type ProposeRescheduleFormValues,
} from "../types/serviceReschedule.forms";

export interface ProposeRescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rescheduleRequestId: string | null;
  onSuccess?: () => void;
}

export function ProposeRescheduleDialog({
  open,
  onOpenChange,
  rescheduleRequestId,
  onSuccess,
}: ProposeRescheduleDialogProps) {
  const minDate = useMemo(() => addCalendarDaysIso(todayCalendarIso(), 1), []);
  const { proposeReschedule } = useServiceRescheduleMutations();
  const form = useForm<ProposeRescheduleFormValues>({
    mode: "onChange",
    resolver: zodResolver(proposeRescheduleFormSchema),
    defaultValues: {
      startDate: minDate,
      endDate: "",
      shift: "morning",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        startDate: minDate,
        endDate: "",
        shift: "morning",
      });
    }
  }, [open, form, minDate]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!rescheduleRequestId) return;

    try {
      await proposeReschedule.mutateAsync({
        rescheduleRequestId,
        newSlot: {
          start_date: values.startDate,
          end_date: values.endDate.trim() || null,
          shift: values.shift,
        },
      });

      toast.success("Nova data proposta com sucesso.");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao propor nova data.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propor nova data</DialogTitle>
          <DialogDescription>
            O cliente precisará confirmar a data proposta para que o reagendamento seja efetivado.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="propose-reschedule-form" onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="reschedule-start-date">Início</Label>
                    <FormControl>
                      <Input
                        id="reschedule-start-date"
                        type="date"
                        min={minDate}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="reschedule-end-date">Fim (opcional)</Label>
                    <FormControl>
                      <Input
                        id="reschedule-end-date"
                        type="date"
                        min={minDate}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shift"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="reschedule-shift">Turno</Label>
                    <FormControl>
                      <select
                        id="reschedule-shift"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        {...field}
                      >
                        <option value="morning">Manhã</option>
                        <option value="afternoon">Tarde</option>
                        <option value="full_day">Dia inteiro</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={proposeReschedule.isPending}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                form="propose-reschedule-form"
                disabled={proposeReschedule.isPending || !rescheduleRequestId}
              >
                {proposeReschedule.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Enviando…
                  </>
                ) : (
                  "Enviar proposta"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
