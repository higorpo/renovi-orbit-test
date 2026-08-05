/**
 * Read-only frozen evidence review for the client (Task 51).
 */

import { CompletionCriterionBlock, StaticTextBlock } from "@/features/dynamic-form";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseCompletionChecklistBlocks } from "../utils/parseChecklistSchema";
import type {
  CompletionCriterionResponse,
  CompletionResponsesMap,
} from "../types/completion.types";

export type FrozenEvidenceReviewProps = {
  checklistSchema: Record<string, unknown> | null | undefined;
  responses: CompletionResponsesMap | null | undefined;
  executedLate?: boolean | null;
  className?: string;
};

export function FrozenEvidenceReview({
  checklistSchema,
  responses,
  executedLate = false,
  className,
}: FrozenEvidenceReviewProps) {
  const blocks = parseCompletionChecklistBlocks(checklistSchema);
  const map = responses ?? {};

  return (
    <div
      className={cn("space-y-4", className)}
      data-testid="frozen-evidence-review"
    >
      {executedLate ? (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
          data-testid="executed-late-badge"
        >
          Executado com atraso
        </Badge>
      ) : null}

      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Pacote de evidências indisponível.
        </p>
      ) : (
        <ul className="space-y-4">
          {blocks.map((block) => {
            if (block.type === "static_text") {
              return (
                <li key={block.id} className="rounded-lg bg-muted/40 px-3 py-2">
                  <StaticTextBlock block={block} />
                </li>
              );
            }
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
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
