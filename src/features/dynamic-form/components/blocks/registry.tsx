import type { ReactNode } from "react";
import type { FormBlock, FormSchema, FormBlockType } from "../../types";
import type { FormData } from "../../types";

import { PropertyTypeBlock } from "./PropertyTypeBlock";
import { UrgencyBlock } from "./UrgencyBlock";
import { DescriptionBlock } from "./DescriptionBlock";
import { SingleSelectBlock } from "./SingleSelectBlock";
import { MultiSelectBlock } from "./MultiSelectBlock";
import { RadioBlock } from "./RadioBlock";
import { CheckboxBlock } from "./CheckboxBlock";
import { TextInputBlock } from "./TextInputBlock";
import { NumberInputBlock } from "./NumberInputBlock";
import { TextareaBlock } from "./TextareaBlock";
import { DateBlock } from "./DateBlock";
import { TimeBlock } from "./TimeBlock";
import { SliderBlock } from "./SliderBlock";
import { ConditionalAlertBlock } from "./ConditionalAlertBlock";
import { StaticTextBlock } from "./StaticTextBlock";
import { PreviewSummaryBlock } from "./PreviewSummaryBlock";
import { ImageGalleryBlock } from "./ImageGalleryBlock";
import { YesNoBlock } from "./YesNoBlock";

/** Unified props passed to every block renderer from StepRenderer. */
export interface BlockRenderProps {
  schema: FormSchema;
  block: FormBlock;
  formData: FormData;
  setFieldValue: (fieldId: string, value: unknown) => void;
  handleFieldChange: (blockId: string, value: unknown) => void;
  onEditFromSummary?: (fieldId: string) => void;
}

type BlockRenderer = (props: BlockRenderProps) => ReactNode;

function renderWithValue<T>(
  props: BlockRenderProps,
  Component: React.ComponentType<{
    block: FormBlock;
    value: T | undefined;
    onChange: (value: T) => void;
    [key: string]: unknown;
  }>,
  extraProps?: Record<string, unknown>
): ReactNode {
  const value = props.formData[props.block.id] as T | undefined;
  const onChange = (val: T) => props.handleFieldChange(props.block.id, val);
  return <Component block={props.block} value={value} onChange={onChange} {...extraProps} />;
}

function renderSingleSelect(props: BlockRenderProps): ReactNode {
  const value = props.formData[props.block.id] as string | undefined;
  const otherText = props.formData[`${props.block.id}_other_text`] as string | undefined;
  return (
    <SingleSelectBlock
      block={props.block}
      value={value}
      onChange={(v) => props.handleFieldChange(props.block.id, v)}
      otherText={otherText}
      onOtherTextChange={(text) => props.setFieldValue(`${props.block.id}_other_text`, text)}
    />
  );
}

function renderMultiSelect(props: BlockRenderProps): ReactNode {
  const value = props.formData[props.block.id] as string[] | undefined;
  const otherText = props.formData[`${props.block.id}_other_text`] as string | undefined;
  return (
    <MultiSelectBlock
      block={props.block}
      value={value}
      onChange={(v) => props.handleFieldChange(props.block.id, v)}
      otherText={otherText}
      onOtherTextChange={(text) => props.setFieldValue(`${props.block.id}_other_text`, text)}
    />
  );
}

function renderPreviewSummary(props: BlockRenderProps): ReactNode {
  return (
    <PreviewSummaryBlock
      schema={props.schema}
      block={props.block}
      formData={props.formData}
      onEdit={props.onEditFromSummary}
    />
  );
}

/** Registry: every FormBlockType must have an entry. Adding a new block type in schema forces adding one here. */
export const blockRegistry: Record<FormBlockType, BlockRenderer> = {
  property_type: (p) => renderWithValue(p, PropertyTypeBlock),
  urgency: (p) => renderWithValue(p, UrgencyBlock),
  description_ai: (p) => renderWithValue(p, DescriptionBlock),
  single_select: renderSingleSelect,
  multi_select: renderMultiSelect,
  radio: (p) => renderWithValue(p, RadioBlock),
  checkbox: (p) => renderWithValue(p, CheckboxBlock),
  yes_no: (p) => renderWithValue(p, YesNoBlock),
  text: (p) => renderWithValue(p, TextInputBlock),
  number: (p) => renderWithValue(p, NumberInputBlock),
  textarea: (p) => renderWithValue(p, TextareaBlock),
  date: (p) => renderWithValue(p, DateBlock),
  time: (p) => renderWithValue(p, TimeBlock),
  slider: (p) => renderWithValue(p, SliderBlock),
  conditional_alert: (p) => <ConditionalAlertBlock block={p.block} />,
  static_text: (p) => <StaticTextBlock block={p.block} />,
  preview_summary: renderPreviewSummary,
  image_gallery: (p) =>
    renderWithValue<string | string[]>(p, ImageGalleryBlock),
};

export function renderBlockByType(props: BlockRenderProps): ReactNode {
  const renderer = blockRegistry[props.block.type];
  if (renderer) return renderer(props);
  return null;
}

export function isBlockTypeRegistered(type: string): boolean {
  return type in blockRegistry;
}
