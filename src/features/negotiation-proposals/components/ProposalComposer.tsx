import { ImagePlus, ShieldCheck } from "lucide-react";
import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PROPOSAL_PHOTOS } from "../constants/proposalComposer";
import type {
  ProposalComposerFormValues,
  ProposalComposerPricing,
} from "../types/proposalComposer.types";
import { getInclusiveDayRangeHint } from "../types/proposalComposer.schema";
import { maskBudgetInput } from "../utils/proposalComposerInput";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  addCalendarDaysIso,
  todayCalendarIso,
} from "@/lib/utils/calendarDate";

export interface ProposalComposerProps {
  form: UseFormReturn<ProposalComposerFormValues>;
  availabilityFieldArray: UseFieldArrayReturn<ProposalComposerFormValues, "availabilitySlots">;
  existingPhotoUrls: string[];
  newPhotos: File[];
  photosCount: number;
  pricing: ProposalComposerPricing | null;
  isPricingLoading: boolean;
  maxDescriptionLength: number;
  maxPhotos?: number;
  onPhotoAdd: (files: FileList | null) => void;
  onExistingPhotoRemove: (index: number) => void;
  onNewPhotoRemove: (index: number) => void;
  onAvailabilitySlotAdd: () => void;
  onAvailabilitySlotRemove: (index: number) => void;
  onInputFocus?: () => void;
  className?: string;
}

export function ProposalComposer({
  form,
  availabilityFieldArray,
  existingPhotoUrls,
  newPhotos,
  photosCount,
  pricing,
  isPricingLoading,
  maxDescriptionLength,
  maxPhotos = MAX_PROPOSAL_PHOTOS,
  onPhotoAdd,
  onExistingPhotoRemove,
  onNewPhotoRemove,
  onAvailabilitySlotAdd,
  onAvailabilitySlotRemove,
  onInputFocus,
  className,
}: ProposalComposerProps) {
  const durationUnit = form.watch("durationUnit");
  const descriptionDraft = form.watch("descriptionDraft") ?? "";

  return (
    <Form {...form}>
      <form className={className} onSubmit={(event) => event.preventDefault()}>
        <div className="space-y-2 sm:pb-2">
          <p className="text-sm text-muted-foreground">
            Defina seu valor com transparência. A taxa cobre intermediação segura, proteção para ambas
            as partes e suporte da plataforma durante a negociação.
          </p>
          <p className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Mais segurança para você e para o cliente.
          </p>
        </div>

        <FormField
          control={form.control}
          name="priceInput"
          render={({ field }) => (
            <FormItem className="mt-4 space-y-2">
              <FormLabel htmlFor="proposal-price">Quanto você quer cobrar?</FormLabel>
              <FormControl>
                <Input
                  id="proposal-price"
                  inputMode="decimal"
                  placeholder="Ex.: 500,00"
                  value={field.value}
                  onChange={(event) => field.onChange(maskBudgetInput(event.target.value))}
                  onFocus={onInputFocus}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isPricingLoading || pricing ? (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3">
            {isPricingLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-5 w-48" />
              </div>
            ) : pricing ? (
              <div className="space-y-1.5 text-sm">
                <p className="text-muted-foreground">
                  Valor informado:{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(pricing.original_amount)}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Taxa da plataforma ({(pricing.tax_rate * 100).toFixed(0)}%):{" "}
                  <span className="font-medium text-foreground">
                    - {formatCurrency(pricing.tax_amount)}
                  </span>
                </p>
                <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
                  Você recebe: {formatCurrency(pricing.final_amount)}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="descriptionDraft"
          render={({ field }) => (
            <FormItem className="mt-4 space-y-2">
              <FormLabel htmlFor="proposal-description">Descrição do orçamento</FormLabel>
              <FormControl>
                <Textarea
                  id="proposal-description"
                  value={field.value}
                  onChange={field.onChange}
                  onFocus={onInputFocus}
                  placeholder="Descreva como você vai executar o serviço, prazo estimado e diferenciais."
                  className="min-h-32 resize-y max-sm:resize-none"
                />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
                {descriptionDraft.length}/{maxDescriptionLength} caracteres
              </p>
            </FormItem>
          )}
        />

        <div className="mt-4 space-y-3 rounded-lg border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="durationValueInput"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel htmlFor="proposal-duration-value">
                    Tempo estimado para executar
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="proposal-duration-value"
                      inputMode="numeric"
                      placeholder="Ex.: 5"
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(event.target.value.replace(/[^\d]/g, ""))}
                      onFocus={onInputFocus}
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
                <FormItem className="space-y-2">
                  <FormLabel htmlFor="proposal-duration-unit">Unidade</FormLabel>
                  <FormControl>
                    <select
                      id="proposal-duration-unit"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FormLabel>Dias sugeridos para execução (1 a 3 opções)</FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAvailabilitySlotAdd}
                disabled={availabilityFieldArray.fields.length >= 3}
              >
                Adicionar opção
              </Button>
            </div>
            <div className="space-y-2">
              {availabilityFieldArray.fields.map((field, index) => {
                const slot = form.watch(`availabilitySlots.${index}`);
                const dayRangeHint =
                  durationUnit === "days"
                    ? getInclusiveDayRangeHint(slot?.startDate ?? "", slot?.endDate ?? "")
                    : null;

                return (
                  <div key={field.id} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">Opção {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onAvailabilitySlotRemove(index)}
                        disabled={availabilityFieldArray.fields.length <= 1}
                      >
                        Remover
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name={`availabilitySlots.${index}.startDate`}
                        render={({ field: startField }) => (
                          <FormItem className="space-y-1">
                            <FormLabel htmlFor={`slot-start-${index}`}>Início</FormLabel>
                            <FormControl>
                              <Input
                                id={`slot-start-${index}`}
                                type="date"
                                min={addCalendarDaysIso(todayCalendarIso(), 1)}
                                value={startField.value}
                                onChange={startField.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {durationUnit === "days" ? (
                        <FormField
                          control={form.control}
                          name={`availabilitySlots.${index}.endDate`}
                          render={({ field: endField }) => (
                            <FormItem className="space-y-1">
                              <FormLabel htmlFor={`slot-end-${index}`}>Fim</FormLabel>
                              <FormControl>
                                <Input
                                  id={`slot-end-${index}`}
                                  type="date"
                                  min={addCalendarDaysIso(todayCalendarIso(), 1)}
                                  value={endField.value}
                                  onChange={endField.onChange}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : null}

                      <FormField
                        control={form.control}
                        name={`availabilitySlots.${index}.shift`}
                        render={({ field: shiftField }) => (
                          <FormItem className="space-y-1">
                            <FormLabel htmlFor={`slot-shift-${index}`}>Turno</FormLabel>
                            <FormControl>
                              <select
                                id={`slot-shift-${index}`}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                value={shiftField.value}
                                onChange={shiftField.onChange}
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
                    {dayRangeHint ? (
                      <p
                        className={
                          dayRangeHint.isError
                            ? "mt-2 text-xs text-destructive"
                            : "mt-2 text-xs text-muted-foreground"
                        }
                      >
                        {dayRangeHint.message}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <FormLabel htmlFor="proposal-photos">Fotos do orçamento (opcional)</FormLabel>
          <div className="rounded-lg border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Anexe imagens de referência</p>
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, WebP, HEIC ou HEIF, até 5 MB por imagem.
                </p>
              </div>
              <label htmlFor="proposal-photos" className="w-full sm:w-auto">
                <span className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted sm:w-auto">
                  <ImagePlus className="mr-2 h-4 w-4" aria-hidden />
                  Escolher imagens
                </span>
              </label>
            </div>
            <Input
              id="proposal-photos"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="hidden"
              onChange={(event) => {
                onPhotoAdd(event.target.files);
                event.currentTarget.value = "";
              }}
            />
            <span className="mt-2 inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
              <ImagePlus className="h-4 w-4" aria-hidden />
              {photosCount}/{maxPhotos} imagens selecionadas
            </span>
          </div>

          {existingPhotoUrls.length > 0 ? (
            <div className="space-y-2">
              {existingPhotoUrls.map((photoUrl, index) => (
                <div
                  key={`${photoUrl}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={photoUrl}
                      alt={`Imagem atual do orçamento ${index + 1}`}
                      className="h-10 w-10 rounded object-cover"
                    />
                    <p className="truncate text-sm text-muted-foreground">
                      Imagem atual #{index + 1}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onExistingPhotoRemove(index)}
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {newPhotos.length > 0 ? (
            <div className="space-y-2">
              {newPhotos.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <p className="truncate pr-3 text-sm">{file.name}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onNewPhotoRemove(index)}>
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </form>
    </Form>
  );
}
