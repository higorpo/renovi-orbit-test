import { CircleDollarSign, ImagePlus, Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { ProviderProposalPricing } from "../api/providerProposals.api";

interface ProviderProposalComposerDialogProps {
  open: boolean;
  isSubmitting: boolean;
  isPricingLoading: boolean;
  priceInput: string;
  descriptionDraft: string;
  durationValueInput: string;
  durationUnit: "hours" | "days";
  availabilitySlots: Array<{
    startDate: string;
    endDate: string;
    shift: "morning" | "afternoon" | "full_day";
  }>;
  existingPhotoUrls: string[];
  newPhotos: File[];
  photosCount: number;
  pricing: ProviderProposalPricing | null;
  maxDescriptionLength: number;
  maxPhotos: number;
  canSubmit: boolean;
  onOpenChange: (open: boolean) => void;
  onPriceInputChange: (value: string) => void;
  onDescriptionDraftChange: (value: string) => void;
  onDurationValueInputChange: (value: string) => void;
  onDurationUnitChange: (value: "hours" | "days") => void;
  onAvailabilitySlotChange: (
    index: number,
    field: "startDate" | "endDate" | "shift",
    value: string,
  ) => void;
  onAvailabilitySlotAdd: () => void;
  onAvailabilitySlotRemove: (index: number) => void;
  onPhotoAdd: (files: FileList | null) => void;
  onExistingPhotoRemove: (index: number) => void;
  onNewPhotoRemove: (index: number) => void;
  onSubmit: () => Promise<void>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Inclusive calendar days from start to end (matches proposal validation). */
function getInclusiveDayRangeHint(startDate: string, endDate: string): {
  message: string;
  isError: boolean;
} | null {
  if (!startDate.trim() || !endDate.trim()) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end < start) {
    return { message: "A data final não pode ser anterior à inicial.", isError: true };
  }
  const inclusiveDays =
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysLabel = inclusiveDays === 1 ? "1 dia" : `${inclusiveDays} dias`;
  return {
    message: `Intervalo: ${daysLabel} (início e fim inclusos)`,
    isError: false,
  };
}

export function ProviderProposalComposerDialog({
  open,
  isSubmitting,
  isPricingLoading,
  priceInput,
  descriptionDraft,
  durationValueInput,
  durationUnit,
  availabilitySlots,
  existingPhotoUrls,
  newPhotos,
  photosCount,
  pricing,
  maxDescriptionLength,
  maxPhotos,
  canSubmit,
  onOpenChange,
  onPriceInputChange,
  onDescriptionDraftChange,
  onDurationValueInputChange,
  onDurationUnitChange,
  onAvailabilitySlotChange,
  onAvailabilitySlotAdd,
  onAvailabilitySlotRemove,
  onPhotoAdd,
  onExistingPhotoRemove,
  onNewPhotoRemove,
  onSubmit,
}: ProviderProposalComposerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen w-screen max-w-none rounded-none border-0 p-0 [&>button]:hidden sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:rounded-lg sm:border sm:p-6">
        <div className="flex h-full min-h-0 flex-col sm:max-h-[calc(90vh-3rem)]">
          <DialogHeader className="shrink-0 border-b px-4 py-4 text-left sm:border-b-0 sm:px-0 sm:py-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CircleDollarSign className="h-5 w-5 text-primary" aria-hidden />
                Enviar proposta
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
            <DialogDescription className="space-y-2 sm:pb-4">
              <span className="block">
                Defina seu valor com transparência. A taxa cobre intermediação segura, proteção para ambas as
                partes e suporte da plataforma durante a negociação.
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Mais segurança para você e para o cliente.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-0 sm:py-0">
            <div className="space-y-2">
              <Label htmlFor="proposal-price">Quanto você quer cobrar?</Label>
              <Input
                id="proposal-price"
                inputMode="decimal"
                placeholder="Ex.: 500,00"
                value={priceInput}
                onChange={(event) => onPriceInputChange(event.target.value)}
              />
            </div>

            {(isPricingLoading || pricing) && (
              <div className="rounded-lg border bg-muted/30 p-3">
                {isPricingLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-52" />
                    <Skeleton className="h-5 w-48" />
                  </div>
                ) : pricing ? (
                  <div className="space-y-1.5 text-sm">
                    <p className="text-muted-foreground">
                      Valor informado: <span className="font-medium text-foreground">{formatCurrency(pricing.original_amount)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Taxa da plataforma ({(pricing.tax_rate * 100).toFixed(0)}%):{" "}
                      <span className="font-medium text-foreground">- {formatCurrency(pricing.tax_amount)}</span>
                    </p>
                    <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
                      Você recebe: {formatCurrency(pricing.final_amount)}
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="proposal-description">Descrição da proposta</Label>
              <Textarea
                id="proposal-description"
                value={descriptionDraft}
                onChange={(event) => onDescriptionDraftChange(event.target.value)}
                placeholder="Descreva como você vai executar o serviço, prazo estimado e diferenciais."
                className="min-h-32 resize-y"
              />
              <p className="text-xs text-muted-foreground">
                {descriptionDraft.length}/{maxDescriptionLength} caracteres
              </p>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="proposal-duration-value">Tempo estimado para executar</Label>
                  <Input
                    id="proposal-duration-value"
                    inputMode="numeric"
                    placeholder="Ex.: 5"
                    value={durationValueInput}
                    onChange={(event) => onDurationValueInputChange(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal-duration-unit">Unidade</Label>
                  <select
                    id="proposal-duration-unit"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={durationUnit}
                    onChange={(event) => onDurationUnitChange(event.target.value as "hours" | "days")}
                  >
                    <option value="hours">Horas</option>
                    <option value="days">Dias</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Dias sugeridos para execução (1 a 3 opções)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onAvailabilitySlotAdd}
                    disabled={availabilitySlots.length >= 3}
                  >
                    Adicionar opção
                  </Button>
                </div>
                <div className="space-y-2">
                  {availabilitySlots.map((slot, index) => {
                    const dayRangeHint =
                      durationUnit === "days"
                        ? getInclusiveDayRangeHint(slot.startDate, slot.endDate)
                        : null;
                    return (
                    <div key={`availability-slot-${index}`} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium">Opção {index + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onAvailabilitySlotRemove(index)}
                          disabled={availabilitySlots.length <= 1}
                        >
                          Remover
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label htmlFor={`slot-start-${index}`}>Início</Label>
                          <Input
                            id={`slot-start-${index}`}
                            type="date"
                            value={slot.startDate}
                            onChange={(event) =>
                              onAvailabilitySlotChange(index, "startDate", event.target.value)}
                          />
                        </div>
                        {durationUnit === "days" && (
                          <div className="space-y-1">
                            <Label htmlFor={`slot-end-${index}`}>Fim</Label>
                            <Input
                              id={`slot-end-${index}`}
                              type="date"
                              value={slot.endDate}
                              onChange={(event) =>
                                onAvailabilitySlotChange(index, "endDate", event.target.value)}
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label htmlFor={`slot-shift-${index}`}>Turno</Label>
                          <select
                            id={`slot-shift-${index}`}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            value={slot.shift}
                            onChange={(event) =>
                              onAvailabilitySlotChange(index, "shift", event.target.value)}
                          >
                            <option value="morning">Manhã</option>
                            <option value="afternoon">Tarde</option>
                            <option value="full_day">Dia inteiro</option>
                          </select>
                        </div>
                      </div>
                      {dayRangeHint && (
                        <p
                          className={
                            dayRangeHint.isError
                              ? "mt-2 text-xs text-destructive"
                              : "mt-2 text-xs text-muted-foreground"
                          }
                        >
                          {dayRangeHint.message}
                        </p>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposal-photos">Fotos da proposta (opcional)</Label>
              <div className="rounded-lg border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Anexe imagens de referência</p>
                    <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP, até 5 MB por imagem.</p>
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
                  accept="image/jpeg,image/png,image/webp"
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
              {existingPhotoUrls.length > 0 && (
                <div className="space-y-2">
                  {existingPhotoUrls.map((photoUrl, index) => (
                    <div
                      key={`${photoUrl}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <img
                          src={photoUrl}
                          alt={`Imagem atual da proposta ${index + 1}`}
                          className="h-10 w-10 rounded object-cover"
                        />
                        <p className="truncate text-sm text-muted-foreground">Imagem atual #{index + 1}</p>
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
              )}
              {newPhotos.length > 0 && (
                <div className="space-y-2">
                  {newPhotos.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <p className="truncate pr-3 text-sm">{file.name}</p>
                      <Button type="button" variant="ghost" size="sm" onClick={() => onNewPhotoRemove(index)}>
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-2 shrink-0 flex-row gap-2 border-t px-4 py-3 sm:mt-4 sm:border-t-0 sm:px-0 sm:py-0 [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void onSubmit()} disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Enviando...
                </>
              ) : (
                "Enviar proposta"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
