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
import { getInclusiveDayRangeHint } from "@/features/negotiation-proposals";
import {
  addCalendarDaysIso,
  todayCalendarIso,
} from "@/features/view-services/utils/serviceCalendarDate";
import { useRescheduleRequestDetail } from "../hooks/useRescheduleRequestDetail";
import { useServiceRescheduleMutations } from "../hooks/useServiceRescheduleMutations";
import {
  proposeRescheduleFormSchema,
  type ProposeRescheduleFormValues,
} from "../types/serviceReschedule.forms";
import {
  buildRescheduleProposedSlot,
  deriveRescheduleDateMode,
} from "../utils/deriveRescheduleDateMode";

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
  const { snapshot, isLoading: isSnapshotLoading } = useRescheduleRequestDetail(
    rescheduleRequestId,
    open,
  );
  const { proposeReschedule } = useServiceRescheduleMutations();

  const form = useForm<ProposeRescheduleFormValues>({
    mode: "onChange",
    resolver: zodResolver(proposeRescheduleFormSchema),
    defaultValues: {
      startDate: minDate,
      endDate: "",
      shift: "morning",
      durationValueInput: "1",
      durationUnit: "hours",
    },
  });

  const durationUnit = form.watch("durationUnit");
  const durationValueInput = form.watch("durationValueInput");
  const startDateValue = form.watch("startDate");
  const endDateValue = form.watch("endDate");

  const durationValue = Number.parseInt(durationValueInput || "0", 10);
  const dateMode = deriveRescheduleDateMode(
    durationUnit,
    Number.isFinite(durationValue) ? durationValue : 0,
  );
  const showEndDate = dateMode === "date_range";
  const rangeHint = showEndDate
    ? getInclusiveDayRangeHint(startDateValue ?? "", endDateValue ?? "")
    : null;

  useEffect(() => {
    if (!open || !snapshot) return;

    form.reset({
      startDate: minDate,
      endDate: "",
      shift: "morning",
      durationValueInput: String(snapshot.durationValue),
      durationUnit: snapshot.durationUnit,
    });
  }, [open, form, minDate, snapshot]);

  useEffect(() => {
    if (!showEndDate && form.getValues("endDate")) {
      form.setValue("endDate", "", { shouldValidate: true });
    }
  }, [showEndDate, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!rescheduleRequestId || !snapshot) return;

    const parsedDurationValue = Number.parseInt(values.durationValueInput, 10);

    try {
      await proposeReschedule.mutateAsync({
        rescheduleRequestId,
        newSlot: buildRescheduleProposedSlot({
          startDate: values.startDate,
          endDate: values.endDate,
          shift: values.shift,
          durationUnit: values.durationUnit,
          durationValue: parsedDurationValue,
        }),
      });

      toast.success("Nova data proposta com sucesso.");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao propor nova data.");
    }
  });

  const isBusy = proposeReschedule.isPending || isSnapshotLoading || !snapshot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propor nova data</DialogTitle>
          <DialogDescription>
            O cliente precisará confirmar a data proposta para que o reagendamento seja efetivado.
          </DialogDescription>
        </DialogHeader>

        {isSnapshotLoading && !snapshot ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando detalhes do serviço…
          </div>
        ) : (
          <Form {...form}>
            <form id="propose-reschedule-form" onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="durationValueInput"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="reschedule-duration-value">
                        Tempo estimado para executar
                      </Label>
                      <FormControl>
                        <Input
                          id="reschedule-duration-value"
                          inputMode="numeric"
                          placeholder="Ex.: 5"
                          value={field.value}
                          onChange={(event) =>
                            field.onChange(event.target.value.replace(/[^\d]/g, ""))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="durationUnit"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="reschedule-duration-unit">Unidade</Label>
                      <FormControl>
                        <select
                          id="reschedule-duration-unit"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          {...field}
                        >
                          <option value="hours">Horas</option>
                          <option value="days">Dias</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div
                className={
                  showEndDate ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"
                }
              >
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="reschedule-start-date">
                        {showEndDate ? "Data de início" : "Data de execução"}
                      </Label>
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

                {showEndDate ? (
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="reschedule-end-date">Data de fim</Label>
                        <FormControl>
                          <Input
                            id="reschedule-end-date"
                            type="date"
                            min={startDateValue || minDate}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

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

              {rangeHint ? (
                <p
                  className={
                    rangeHint.isError
                      ? "text-sm text-destructive"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {rangeHint.message}
                </p>
              ) : null}

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
                  disabled={isBusy || !rescheduleRequestId || !form.formState.isValid}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
