/**
 * MicroStepRenderer — renders the current step: header + all visible blocks at once.
 * Uses a block registry for extensibility.
 */

import type { ReactNode } from "react";
import { useFormContext } from "./FormContext";
import type { FormBlockV2, FormSchemaV2 } from "../types";
import { getRelatedAlerts } from "../types/formSchemaV2/helpers";
import { cn } from "@/lib/utils";

import { PropertyTypeBlock } from "./blocks/PropertyTypeBlock";
import { UrgencyBlock } from "./blocks/UrgencyBlock";
import { DescriptionBlock } from "./blocks/DescriptionBlock";
import { SingleSelectBlock } from "./blocks/SingleSelectBlock";
import { MultiSelectBlock } from "./blocks/MultiSelectBlock";
import { RadioBlock } from "./blocks/RadioBlock";
import { CheckboxBlock } from "./blocks/CheckboxBlock";
import { TextInputBlock } from "./blocks/TextInputBlock";
import { NumberInputBlock } from "./blocks/NumberInputBlock";
import { TextareaBlock } from "./blocks/TextareaBlock";
import { DateBlock } from "./blocks/DateBlock";
import { TimeBlock } from "./blocks/TimeBlock";
import { SliderBlock } from "./blocks/SliderBlock";
import { ConditionalAlertBlock } from "./blocks/ConditionalAlertBlock";
import { StaticTextBlock } from "./blocks/StaticTextBlock";
import { PreviewSummaryBlock } from "./blocks/PreviewSummaryBlock";
import { ImageGalleryBlock } from "./blocks/ImageGalleryBlock";
import { YesNoBlock } from "./blocks/YesNoBlock";

interface MicroStepRendererProps {
  className?: string;
  onAutoAdvance?: () => void;
}

export function MicroStepRenderer({
  className,
  onAutoAdvance,
}: MicroStepRendererProps) {
  const {
    formData,
    setFieldValue,
    schema,
    currentStepData,
    getVisibleBlocks,
    visibleSteps,
    goToStep,
  } = useFormContext();

  if (!currentStepData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando formulário...
      </div>
    );
  }

  const visibleBlocks = getVisibleBlocks(currentStepData).filter(
    (b) => b.type !== "conditional_alert"
  );

  const handleFieldChange = (blockId: string, value: unknown) => {
    setFieldValue(blockId, value);
    if (
      (visibleBlocks.find((b) => b.id === blockId)?.config?.autoAdvance as boolean) &&
      value != null &&
      value !== "" &&
      onAutoAdvance
    ) {
      setTimeout(() => onAutoAdvance(), 300);
    }
  };

  const handleEditFromSummary = (fieldId: string) => {
    const stepIndex = visibleSteps.findIndex((step) =>
      getVisibleBlocks(step).some((b) => b.id === fieldId)
    );
    if (stepIndex !== -1) goToStep(stepIndex);
  };

  const { title: stepTitle, description: stepDescription, icon: stepIcon } = currentStepData;

  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center space-y-2">
        {stepIcon && (
          <span className="text-3xl block" aria-hidden>
            {stepIcon}
          </span>
        )}
        <h2 className="text-xl font-semibold text-foreground">{stepTitle}</h2>
        {stepDescription && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {stepDescription}
          </p>
        )}
      </div>
      <div className="space-y-6 py-2">
        {visibleBlocks.map((block) => {
          const relatedAlerts = getRelatedAlerts(block.id, currentStepData, formData);
          const renderedBlock = renderBlock(
            schema,
            block,
            formData,
            setFieldValue,
            (blockId, value) => handleFieldChange(blockId, value),
            handleEditFromSummary
          );
          return (
            <div key={block.id} className="space-y-2">
              {renderedBlock}
              {relatedAlerts.length > 0 && (
                <div className="space-y-2">
                  {relatedAlerts.map((alert) => (
                    <ConditionalAlertBlock key={alert.id} block={alert} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderBlock(
  schema: FormSchemaV2,
  b: FormBlockV2,
  formData: Record<string, unknown>,
  setFieldValue: (fieldId: string, value: unknown) => void,
  handleFieldChange: (blockId: string, value: unknown) => void,
  onEditFromSummary?: (fieldId: string) => void
): ReactNode {
  const value = formData[b.id];
  const onChange = (val: unknown) => handleFieldChange(b.id, val);

  switch (b.type) {
    case "property_type":
      return (
        <PropertyTypeBlock
          block={b}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
        />
      );
    case "urgency":
      return (
        <UrgencyBlock
          block={b}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
        />
      );
    case "description_ai":
      return (
        <DescriptionBlock
          block={b}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
        />
      );
    case "single_select":
      return (
        <SingleSelectBlock
          block={b}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
          otherText={formData[`${b.id}_other_text`] as string | undefined}
          onOtherTextChange={(text) =>
            setFieldValue(`${b.id}_other_text`, text)
          }
        />
      );
    case "multi_select":
      return (
        <MultiSelectBlock
          block={b}
          value={value as string[] | undefined}
          onChange={onChange as (v: string[]) => void}
          otherText={formData[`${b.id}_other_text`] as string | undefined}
          onOtherTextChange={(text) =>
            setFieldValue(`${b.id}_other_text`, text)
          }
        />
      );
    case "radio":
      return (
        <RadioBlock
          block={b}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
        />
      );
    case "checkbox":
      return (
        <CheckboxBlock
          block={b}
          value={value as string[] | undefined}
          onChange={onChange as (v: string[]) => void}
        />
      );
    case "yes_no":
      return (
        <YesNoBlock
          block={b}
          value={value as boolean | undefined}
          onChange={onChange as (v: boolean) => void}
        />
      );
    case "text":
      return (
        <TextInputBlock
          block={b}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
        />
      );
    case "number":
      return (
        <NumberInputBlock
          block={b}
          value={value as number | undefined}
          onChange={onChange as (v: number) => void}
        />
      );
    case "textarea":
      return (
        <TextareaBlock
          block={b}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
        />
      );
    case "date":
      return (
        <DateBlock
          block={b}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
        />
      );
    case "time":
      return (
        <TimeBlock
          block={b}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
        />
      );
    case "slider":
      return (
        <SliderBlock
          block={b}
          value={value as number | undefined}
          onChange={onChange as (v: number) => void}
        />
      );
    case "conditional_alert":
      return <ConditionalAlertBlock block={b} />;
    case "static_text":
      return <StaticTextBlock block={b} />;
    case "preview_summary":
      return (
        <PreviewSummaryBlock
          schema={schema}
          block={b}
          formData={formData}
          onEdit={onEditFromSummary}
        />
      );
    case "image_gallery":
      return (
        <ImageGalleryBlock
          block={b}
          value={value as string | string[] | undefined}
          onChange={onChange as (v: string | string[]) => void}
        />
      );
    default:
      return (
        <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg">
          <p className="text-destructive text-sm font-medium">
            Tipo de bloco não suportado: &quot;{(b as FormBlockV2).type}&quot;
          </p>
          <p className="text-destructive/70 text-xs mt-1">ID: {b.id}</p>
        </div>
      );
  }
}
