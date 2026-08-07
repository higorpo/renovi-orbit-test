/**
 * Edge-side checklist schema validation (mirrors enrichment_validate_checklist_schema).
 * Final authority remains the Postgres RPC inside enrichment_finalize_ready.
 */

import { stripJsonCodeFence } from "../_shared/ai/jsonFence.ts";
import {
  ALLOWED_BLOCK_TYPES,
  DEFAULT_CRITERION_MAX,
  DEFAULT_CRITERION_MIN,
  DEFAULT_EVIDENCE_MAX,
  DEFAULT_EVIDENCE_MIN,
} from "./constants.ts";
import type {
  ChecklistBlock,
  ChecklistSchema,
  CompletionCriterionBlock,
  StaticTextBlock,
} from "./types.ts";

const ALLOWED = new Set<string>(ALLOWED_BLOCK_TYPES);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseIntStrict(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

export type ValidateOptions = {
  criterionMin?: number;
  criterionMax?: number;
  evidenceMinDefault?: number;
  evidenceMaxDefault?: number;
};

export function validateChecklistSchema(
  schema: unknown,
  options: ValidateOptions = {},
): { ok: true; schema: ChecklistSchema } | { ok: false; reason: string } {
  const criterionMin = options.criterionMin ?? DEFAULT_CRITERION_MIN;
  const criterionMax = options.criterionMax ?? DEFAULT_CRITERION_MAX;
  const evidenceMinDefault = options.evidenceMinDefault ?? DEFAULT_EVIDENCE_MIN;
  const evidenceMaxDefault = options.evidenceMaxDefault ?? DEFAULT_EVIDENCE_MAX;

  if (!isPlainObject(schema)) {
    return { ok: false, reason: "schema_not_object" };
  }

  if (Object.prototype.hasOwnProperty.call(schema, "evidence_images")) {
    return { ok: false, reason: "evidence_images_forbidden" };
  }

  if (schema.version !== 1 && schema.version !== undefined) {
    // version is present on seeds; tolerate missing but reject wrong values
    return { ok: false, reason: "invalid_version" };
  }

  if (!Array.isArray(schema.blocks)) {
    return { ok: false, reason: "blocks_not_array" };
  }

  const blocks: ChecklistBlock[] = [];
  let criterionCount = 0;
  const ids = new Set<string>();

  for (const raw of schema.blocks) {
    if (!isPlainObject(raw)) {
      return { ok: false, reason: "block_not_object" };
    }

    const type = typeof raw.type === "string" ? raw.type.trim() : "";
    if (!ALLOWED.has(type)) {
      return { ok: false, reason: "type_not_allowlisted" };
    }

    if (type === "static_text") {
      const content = typeof raw.content === "string" ? raw.content.trim() : "";
      if (!content) {
        return { ok: false, reason: "static_text_empty" };
      }
      const block: StaticTextBlock = {
        id: typeof raw.id === "string" ? raw.id : undefined,
        type: "static_text",
        content,
      };
      blocks.push(block);
      continue;
    }

    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    if (!id || !label) {
      return { ok: false, reason: "criterion_id_or_label_missing" };
    }
    if (ids.has(id)) {
      return { ok: false, reason: "duplicate_criterion_id" };
    }
    ids.add(id);

    const config = raw.config;
    if (!isPlainObject(config)) {
      return { ok: false, reason: "config_missing" };
    }

    if (!Object.prototype.hasOwnProperty.call(config, "requires_evidence_when_met")) {
      return { ok: false, reason: "requires_evidence_when_met_missing" };
    }

    const requires = parseBool(config.requires_evidence_when_met);
    if (requires === null) {
      return { ok: false, reason: "requires_evidence_when_met_invalid" };
    }

    let evidenceMin = evidenceMinDefault;
    if (Object.prototype.hasOwnProperty.call(config, "evidence_min")) {
      const parsed = parseIntStrict(config.evidence_min);
      if (parsed === null || parsed < 1) {
        return { ok: false, reason: "evidence_min_invalid" };
      }
      evidenceMin = parsed;
    }

    let evidenceMax = evidenceMaxDefault;
    if (Object.prototype.hasOwnProperty.call(config, "evidence_max")) {
      const parsed = parseIntStrict(config.evidence_max);
      if (parsed === null) {
        return { ok: false, reason: "evidence_max_invalid" };
      }
      evidenceMax = parsed;
    }

    if (evidenceMax < evidenceMin || evidenceMax > evidenceMaxDefault) {
      return { ok: false, reason: "evidence_bounds_invalid" };
    }

    const required = parseBool(raw.required);
    const block: CompletionCriterionBlock = {
      id,
      type: "completion_criterion",
      label,
      required: required ?? true,
      config: {
        requires_evidence_when_met: requires,
        evidence_min: evidenceMin,
        evidence_max: evidenceMax,
      },
    };
    if (typeof raw.helpText === "string" && raw.helpText.trim()) {
      block.helpText = raw.helpText.trim();
    }

    blocks.push(block);
    criterionCount += 1;
  }

  if (criterionCount < criterionMin || criterionCount > criterionMax) {
    return { ok: false, reason: "criterion_cardinality" };
  }

  return {
    ok: true,
    schema: {
      version: 1,
      blocks,
    },
  };
}

/** Parse LLM JSON content that may be wrapped in markdown fences. */
export function parseChecklistJson(raw: string): unknown {
  return JSON.parse(stripJsonCodeFence(raw));
}
