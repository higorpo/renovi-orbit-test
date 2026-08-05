/** Truncate oversized SR context before LLM (design §5.2 / Task 29). */

import { MAX_CONTEXT_CHARS } from "./constants.ts";
import type { ServiceRequestContext } from "./types.ts";

export type RawServiceRequestRow = {
  id: string;
  service_id: string | null;
  title: string | null;
  description: string | null;
  form_data: unknown;
};

function payloadLength(
  title: string | null,
  description: string | null,
  form_data: Record<string, unknown> | null,
): number {
  return JSON.stringify({ title, description, form_data }).length;
}

export function buildServiceRequestContext(
  row: RawServiceRequestRow,
  categoryId: string | null,
  maxContextChars: number = MAX_CONTEXT_CHARS,
): ServiceRequestContext {
  const formData =
    row.form_data && typeof row.form_data === "object" && !Array.isArray(row.form_data)
      ? (row.form_data as Record<string, unknown>)
      : null;

  let title = row.title;
  let description = row.description;
  let form_data = formData;
  let truncated = false;
  const originalChars = payloadLength(title, description, form_data);

  if (originalChars > maxContextChars) {
    truncated = true;

    // Prefer keeping title + description; shrink form_data first.
    const wrapperOverhead = JSON.stringify({
      _truncated: "",
      _truncated_note: "form_data truncated for LLM context budget",
    }).length;
    const baseWithoutForm = payloadLength(title, description, null);
    const formBudget = Math.max(
      0,
      maxContextChars - baseWithoutForm - wrapperOverhead,
    );

    if (form_data) {
      const formJson = JSON.stringify(form_data);
      form_data = {
        _truncated: formJson.slice(0, formBudget),
        _truncated_note: "form_data truncated for LLM context budget",
      };
    }

    // If still over (very long title/description), trim description then title.
    if (payloadLength(title, description, form_data) > maxContextChars) {
      const withoutDesc = payloadLength(title, null, form_data);
      const descBudget = Math.max(0, maxContextChars - withoutDesc - 8);
      if (description) {
        description = description.slice(0, descBudget);
      }
    }

    if (payloadLength(title, description, form_data) > maxContextChars) {
      const withoutTitle = payloadLength(null, description, form_data);
      const titleBudget = Math.max(0, maxContextChars - withoutTitle - 8);
      if (title) {
        title = title.slice(0, titleBudget);
      }
    }
  }

  const truncatedChars = payloadLength(title, description, form_data);

  return {
    service_request_id: row.id,
    service_id: row.service_id,
    category_id: categoryId,
    title,
    description,
    form_data,
    truncated,
    original_chars: originalChars,
    truncated_chars: truncatedChars,
  };
}

export function formatContextForPrompt(ctx: ServiceRequestContext): string {
  return JSON.stringify(
    {
      title: ctx.title,
      description: ctx.description,
      form_data: ctx.form_data,
      service_id: ctx.service_id,
      category_id: ctx.category_id,
    },
    null,
    2,
  );
}
