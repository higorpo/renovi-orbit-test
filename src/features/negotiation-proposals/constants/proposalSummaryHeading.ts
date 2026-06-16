import { cn } from "@/lib/utils";

export type ProposalSummaryHeadingSize = "card" | "section";

export function getProposalSummaryHeadingClassName(
  headingSize: ProposalSummaryHeadingSize = "card",
  className?: string,
) {
  return cn(
    headingSize === "section"
      ? "font-display text-sm font-semibold text-ink"
      : "text-base font-semibold leading-tight text-foreground",
    className,
  );
}

export function getProposalHistoryTriggerClassName(
  headingSize: ProposalSummaryHeadingSize = "card",
  className?: string,
) {
  return cn(
    headingSize === "section"
      ? "py-2 font-display text-sm font-semibold text-ink hover:no-underline"
      : undefined,
    className,
  );
}
