import type { FormBlock } from "@/features/dynamic-form";
import { validateCompletionCriterionValue } from "@/features/dynamic-form";
import type { CompletionResponsesMap } from "../types/completion.types";

export type ExecutedResponseIssue = {
  blockId: string;
  label: string;
  error: string;
};

export type ValidateExecutedResponsesResult = {
  valid: boolean;
  issues: ExecutedResponseIssue[];
};

/**
 * Client-side mirror of service_completion_validate_evidence_responses.
 * Server remains authoritative on submit.
 */
export function validateExecutedResponses(
  blocks: FormBlock[],
  responses: CompletionResponsesMap,
): ValidateExecutedResponsesResult {
  const issues: ExecutedResponseIssue[] = [];

  for (const block of blocks) {
    if (block.type !== "completion_criterion") continue;
    const result = validateCompletionCriterionValue(block, responses[block.id]);
    if (!result.valid) {
      issues.push({
        blockId: block.id,
        label: block.label || block.id,
        error: result.error ?? "Resposta incompleta",
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
