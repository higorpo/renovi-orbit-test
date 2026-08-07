/**
 * Read-only frozen evidence review for the client (Task 51).
 */

import type { ReactNode } from "react";
import {
  CompletionCriterionBlock,
  type CompletionCriterionEvidenceRenderArgs,
} from "@/features/dynamic-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { parseCompletionChecklistBlocks } from "../utils/parseChecklistSchema";
import type {
  CompletionCriterionResponse,
  CompletionResponsesMap,
} from "../types/completion.types";

export type FrozenEvidenceReviewProps = {
  checklistSchema: Record<string, unknown> | null | undefined;
  responses: CompletionResponsesMap | null | undefined;
  /** System auto-marked EXECUTED without provider checklist. */
  autoExecutedWithoutChecklist?: boolean | null;
  className?: string;
  renderEvidence?: (args: CompletionCriterionEvidenceRenderArgs) => ReactNode;
};

export function FrozenEvidenceReview({
  checklistSchema,
  responses,
  autoExecutedWithoutChecklist = false,
  className,
  renderEvidence,
}: FrozenEvidenceReviewProps) {
  const blocks = parseCompletionChecklistBlocks(checklistSchema);
  const map = responses ?? {};

  if (autoExecutedWithoutChecklist) {
    return (
      <div
        className={cn("space-y-4", className)}
        data-testid="frozen-evidence-review"
        data-auto-executed-without-checklist="true"
      >
        <Alert data-testid="auto-executed-without-checklist-alert">
          <AlertTitle>Conclusão automática sem checklist</AlertTitle>
          <AlertDescription>
            Este serviço foi marcado como concluído automaticamente pelo sistema,
            sem o checklist de evidências, porque o prestador não registrou a
            conclusão no prazo.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-4", className)}
      data-testid="frozen-evidence-review"
    >
      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Pacote de evidências indisponível.
        </p>
      ) : (
        <ul className="space-y-4">
          {blocks.map((block) => {
            // Instructional static_text tips are redundant with field-level UX.
            if (block.type === "static_text") return null;
            if (block.type !== "completion_criterion") return null;

            const response = map[block.id] as CompletionCriterionResponse | undefined;
            const unmet = response?.met === false;

            return (
              <li
                key={block.id}
                className={cn(
                  "rounded-lg border px-3 py-3",
                  unmet
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-border bg-card",
                )}
                data-unmet={unmet ? "true" : "false"}
              >
                {unmet ? (
                  <p className="mb-2 text-xs font-medium text-destructive">
                    Critério não atendido
                  </p>
                ) : null}
                <CompletionCriterionBlock
                  block={block}
                  value={
                    response
                      ? {
                          met: response.met,
                          justification: response.justification,
                          evidence_paths: response.evidence_paths ?? [],
                        }
                      : undefined
                  }
                  readOnly
                  renderEvidence={renderEvidence}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
