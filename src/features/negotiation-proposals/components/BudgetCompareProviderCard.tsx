import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ServiceRequestBudgetSheetMode } from "../constants/serviceRequestBudgetSheet";
import type { ServiceRequestBudgetCompareProposal } from "../types/serviceRequestBudgetCompare.types";
import {
  resolveClientProposalCtas,
  type ClientProposalCta,
} from "../utils/clientProposalCtas";
import { isPendingProposalStatus } from "../utils/proposalStatus";
import { BudgetCompareProviderHeader } from "./BudgetCompareProviderHeader";
import { ServiceRequestBudgetCompareVersionBlock } from "./ServiceRequestBudgetCompareVersionBlock";

interface BudgetCompareProviderCardProps {
  proposal: ServiceRequestBudgetCompareProposal;
  sheetMode: ServiceRequestBudgetSheetMode;
  onProposalAction?: (action: ClientProposalCta["id"], proposalId: string) => void;
}

export function BudgetCompareProviderCard({
  proposal,
  sheetMode,
  onProposalAction,
}: BudgetCompareProviderCardProps) {
  const showActions =
    sheetMode === "compare" &&
    isPendingProposalStatus(proposal.status) &&
    Boolean(onProposalAction);
  const ctas = showActions
    ? resolveClientProposalCtas(proposal.status, proposal.revision_count ?? 0)
    : [];

  return (
    <article className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="space-y-4 p-4">
        <BudgetCompareProviderHeader
          providerName={proposal.provider_name}
          providerSlug={proposal.provider_slug}
          providerProfileImagePath={proposal.provider_profile_image_path}
          ratingAvg={proposal.rating_avg}
          ratingCount={proposal.rating_count}
          completedServicesCount={proposal.completed_services_count}
        />

        <ServiceRequestBudgetCompareVersionBlock proposal={proposal} />
      </div>

      {ctas.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border/70 bg-muted/10 px-4 py-3 sm:flex-row sm:flex-wrap">
          {ctas.map((cta) => (
            <Button
              key={cta.id}
              type="button"
              size="sm"
              variant={cta.variant}
              disabled={cta.disabled}
              className={cn(
                "h-11 min-h-11 w-full rounded-full px-4 transition-transform duration-150 ease-out active:scale-[0.97] sm:h-10 sm:min-h-10 sm:w-auto",
                cta.id === "accept" && "font-semibold",
              )}
              onClick={() => onProposalAction?.(cta.id, proposal.id)}
            >
              {cta.label}
            </Button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
