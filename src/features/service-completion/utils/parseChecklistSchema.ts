import type { FormBlock } from "@/features/dynamic-form";
import type { CompletionChecklistSchema } from "../types/completion.types";

const ALLOWED_TYPES = new Set(["completion_criterion", "static_text"]);

/**
 * Normalize enrichment checklist_schema into Dynamic Form blocks.
 * Seed templates may use `content` for static_text — map to `label`.
 */
export function parseCompletionChecklistBlocks(
  schema: CompletionChecklistSchema | Record<string, unknown> | null | undefined,
): FormBlock[] {
  if (!schema || typeof schema !== "object") return [];
  const rawBlocks = (schema as CompletionChecklistSchema).blocks;
  if (!Array.isArray(rawBlocks)) return [];

  const blocks: FormBlock[] = [];
  for (const raw of rawBlocks) {
    if (!raw || typeof raw !== "object") continue;
    const type = typeof raw.type === "string" ? raw.type : "";
    if (!ALLOWED_TYPES.has(type)) continue;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) continue;

    const content =
      typeof (raw as { content?: unknown }).content === "string"
        ? (raw as { content: string }).content
        : undefined;
    const label =
      typeof raw.label === "string"
        ? raw.label
        : content ?? "";

    blocks.push({
      id,
      type: type as FormBlock["type"],
      label,
      required: raw.required !== false,
      helpText: typeof raw.helpText === "string" ? raw.helpText : undefined,
      description_ai:
        typeof raw.description_ai === "string" ? raw.description_ai : label,
      config:
        raw.config && typeof raw.config === "object"
          ? (raw.config as FormBlock["config"])
          : undefined,
    });
  }
  return blocks;
}
