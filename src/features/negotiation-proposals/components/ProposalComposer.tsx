import { ImagePlus, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PROPOSAL_PHOTOS } from "../constants/proposalComposer";
import type {
  ProposalAvailabilitySlotDraft,
  ProposalComposerPricing,
  ProposalDurationUnit,
} from "../types/proposalComposer.types";
import {
  getInclusiveDayRangeHint,
  getProposalComposerFieldError,
  validateProposalComposerForm,
} from "../types/proposalComposer.schema";
import { formatCurrency } from "@/lib/formatCurrency";

export interface ProposalComposerProps {
  priceInput: string;
  descriptionDraft: string;
  durationValueInput: string;
  durationUnit: ProposalDurationUnit;
  availabilitySlots: ProposalAvailabilitySlotDraft[];
  existingPhotoUrls: string[];
  newPhotos: File[];
  photosCount: number;
  pricing: ProposalComposerPricing | null;
  isPricingLoading: boolean;
  maxDescriptionLength: number;
  maxPhotos?: number;
  showValidationErrors: boolean;
  onPriceInputChange: (value: string) => void;
  onDescriptionDraftChange: (value: string) => void;
  onDurationValueInputChange: (value: string) => void;
  onDurationUnitChange: (value: ProposalDurationUnit) => void;
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
  onInputFocus?: () => void;
  className?: string;
}

export function ProposalComposer({
  priceInput,
  descriptionDraft,
  durationValueInput,
  durationUnit,
  availabilitySlots,
  existingPhotoUrls,
  newPhotos,
  photosCount,
  pricing,
  isPricingLoading,
  maxDescriptionLength,
  maxPhotos = MAX_PROPOSAL_PHOTOS,
  showValidationErrors,
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
  onInputFocus,
  className,
}: ProposalComposerProps) {
  const validationResult = useMemo(
    () =>
      validateProposalComposerForm({
        priceInput,
        descriptionDraft,
        durationValueInput,
        durationUnit,
        availabilitySlots,
      }, maxDescriptionLength),
    [
      availabilitySlots,
      descriptionDraft,
      durationUnit,
      durationValueInput,
      maxDescriptionLength,
      priceInput,
    ],
  );

  const validationIssues = validationResult.success ? [] : validationResult.error.issues;
  const priceError = getProposalComposerFieldError(validationIssues, ["priceInput"]);
  const descriptionError = getProposalComposerFieldError(validationIssues, ["descriptionDraft"]);
  const durationError = getProposalComposerFieldError(validationIssues, ["durationValueInput"]);
  const availabilityError = getProposalComposerFieldError(validationIssues, ["availabilitySlots"]);

  return (
    <div className={className}>
      <div className="space-y-2 sm:pb-2">
        <p className="text-sm text-muted-foreground">
          Defina seu valor com transparência. A taxa cobre intermediação segura, proteção para ambas as
          partes e suporte da plataforma durante a negociação.
        </p>
        <p className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Mais segurança para você e para o cliente.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="proposal-price">Quanto você quer cobrar?</Label>
        <Input
          id="proposal-price"
          inputMode="decimal"
          placeholder="Ex.: 500,00"
          value={priceInput}
          onChange={(event) => onPriceInputChange(event.target.value)}
          onFocus={onInputFocus}
        />
        {showValidationErrors && priceError ? (
          <p className="text-xs text-destructive">{priceError}</p>
        ) : null}
      </div>

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

      <div className="mt-4 space-y-2">
        <Label htmlFor="proposal-description">Descrição do orçamento</Label>
        <Textarea
          id="proposal-description"
          value={descriptionDraft}
          onChange={(event) => onDescriptionDraftChange(event.target.value)}
          onFocus={onInputFocus}
          placeholder="Descreva como você vai executar o serviço, prazo estimado e diferenciais."
          className="min-h-32 resize-y max-sm:resize-none"
        />
        {showValidationErrors && descriptionError ? (
          <p className="text-xs text-destructive">{descriptionError}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {descriptionDraft.length}/{maxDescriptionLength} caracteres
        </p>
      </div>

      <div className="mt-4 space-y-3 rounded-lg border p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="proposal-duration-value">Tempo estimado para executar</Label>
            <Input
              id="proposal-duration-value"
              inputMode="numeric"
              placeholder="Ex.: 5"
              value={durationValueInput}
              onChange={(event) => onDurationValueInputChange(event.target.value)}
              onFocus={onInputFocus}
            />
            {showValidationErrors && durationError ? (
              <p className="text-xs text-destructive">{durationError}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="proposal-duration-unit">Unidade</Label>
            <select
              id="proposal-duration-unit"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={durationUnit}
              onChange={(event) =>
                onDurationUnitChange(event.target.value as ProposalDurationUnit)}
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
          {showValidationErrors && availabilityError ? (
            <p className="text-xs text-destructive">{availabilityError}</p>
          ) : null}
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
                      {showValidationErrors &&
                      getProposalComposerFieldError(validationIssues, [
                        "availabilitySlots",
                        index,
                        "startDate",
                      ]) ? (
                        <p className="text-xs text-destructive">
                          {getProposalComposerFieldError(validationIssues, [
                            "availabilitySlots",
                            index,
                            "startDate",
                          ])}
                        </p>
                      ) : null}
                    </div>
                    {durationUnit === "days" ? (
                      <div className="space-y-1">
                        <Label htmlFor={`slot-end-${index}`}>Fim</Label>
                        <Input
                          id={`slot-end-${index}`}
                          type="date"
                          value={slot.endDate}
                          onChange={(event) =>
                            onAvailabilitySlotChange(index, "endDate", event.target.value)}
                        />
                        {showValidationErrors &&
                        getProposalComposerFieldError(validationIssues, [
                          "availabilitySlots",
                          index,
                          "endDate",
                        ]) ? (
                          <p className="text-xs text-destructive">
                            {getProposalComposerFieldError(validationIssues, [
                              "availabilitySlots",
                              index,
                              "endDate",
                            ])}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
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
        <Label htmlFor="proposal-photos">Fotos do orçamento (opcional)</Label>
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
    </div>
  );
}

export function isProposalComposerFormValid(
  values: Parameters<typeof validateProposalComposerForm>[0],
  maxDescriptionLength?: number,
): boolean {
  return validateProposalComposerForm(values, maxDescriptionLength).success;
}
