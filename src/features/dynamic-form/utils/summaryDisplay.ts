import type { FormSchema, FormData, PreviewSummaryBlockConfig } from "../types/schema";
import { getBlockById, getDisplayValue, getVisibleSteps, getVisibleBlocks } from "../types/helpers";

export const INPUT_BLOCK_TYPES = new Set([
  "text",
  "textarea",
  "number",
  "single_select",
  "multi_select",
  "radio",
  "checkbox",
  "yes_no",
  "date",
  "time",
  "slider",
  "property_type",
  "urgency",
  "description_ai",
  "image_gallery",
  "completion_criterion",
]);

export interface SummaryEntry {
  id: string;
  label: string;
  displayValue: string;
  rawValue: unknown;
  emoji?: string;
}

export interface SummarySection {
  id?: string;
  title: string;
  icon: string;
  entries: SummaryEntry[];
}

export interface FormCompleteness {
  total: number;
  filled: number;
  percentage: number;
}

function blockToEntry(blockId: string, block: { label: string; type: string; options?: Array<{ value: string; label: string; emoji?: string }> }, value: unknown): SummaryEntry {
  return {
    id: blockId,
    label: block.label,
    displayValue: getDisplayValue(block as Parameters<typeof getDisplayValue>[0], value),
    rawValue: value,
    emoji: block.options?.[0]?.emoji ?? undefined,
  };
}

function isInputBlock(type: string): boolean {
  return INPUT_BLOCK_TYPES.has(type) && type !== "preview_summary";
}

// ─── Flat entries (used by FormResponsesSummary) ───

export function buildSummaryEntries(
  formData: Record<string, unknown> | null,
  formSchema: FormSchema | null,
): SummaryEntry[] {
  if (!formData || Object.keys(formData).length === 0) return [];
  if (!formSchema?.steps?.length) return [];

  const entries: SummaryEntry[] = [];

  for (const step of formSchema.steps) {
    for (const block of step.blocks) {
      if (!isInputBlock(block.type)) continue;

      const rawValue = formData[block.id];
      if (rawValue == null || rawValue === "") continue;
      if (Array.isArray(rawValue) && rawValue.length === 0) continue;

      entries.push(blockToEntry(block.id, block, rawValue));
    }
  }

  return entries;
}

// ─── Sections grouped by steps (used by PreviewSummaryBlock) ───

export function buildSummarySections(
  schema: FormSchema,
  formData: FormData,
): SummarySection[] {
  const visibleSteps = getVisibleSteps(schema, formData);
  const sections: SummarySection[] = [];

  for (const step of visibleSteps) {
    const visibleBlocks = getVisibleBlocks(step, formData).filter((b) =>
      isInputBlock(b.type),
    );
    if (visibleBlocks.length === 0) continue;

    const entries: SummaryEntry[] = visibleBlocks.map((block) =>
      blockToEntry(block.id, block, formData[block.id]),
    );

    sections.push({
      id: step.id,
      title: step.title,
      icon: step.icon ?? "📋",
      entries,
    });
  }

  return sections;
}

export function buildSummarySectionsFromConfig(
  schema: FormSchema,
  formData: FormData,
  config: PreviewSummaryBlockConfig,
): SummarySection[] {
  const sections: SummarySection[] = [];

  for (const sec of config.sections ?? []) {
    const entries: SummaryEntry[] = [];

    for (const fieldId of sec.fieldIds) {
      const block = getBlockById(schema, fieldId);
      if (!block || !isInputBlock(block.type)) continue;
      entries.push(blockToEntry(fieldId, block, formData[fieldId]));
    }

    if (entries.length > 0) {
      sections.push({
        id: sec.id,
        title: sec.title,
        icon: sec.icon ?? "📋",
        entries,
      });
    }
  }

  return sections;
}

// ─── Completeness stats ───

export function getFormCompleteness(
  schema: FormSchema,
  formData: FormData,
): FormCompleteness {
  let total = 0;
  let filled = 0;
  const steps = getVisibleSteps(schema, formData);

  for (const step of steps) {
    for (const block of getVisibleBlocks(step, formData)) {
      if (!isInputBlock(block.type)) continue;
      total++;
      const v = formData[block.id];
      if (v != null && v !== "" && (!Array.isArray(v) || v.length > 0)) filled++;
    }
  }

  return {
    total,
    filled,
    percentage: total === 0 ? 0 : Math.round((filled / total) * 100),
  };
}
