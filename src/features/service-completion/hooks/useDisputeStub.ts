import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  DISPUTE_STUB_ANALYTICS_EVENT,
  openExternalSupportUrl,
  resolveDisputeSupportUrl,
} from "../utils/disputeSupportUrl";

export type OpenDisputeStubArgs = {
  contractedServiceId: string;
  csStatus: string;
  /** Optional remote-config override (orbit.dispute_support_url). */
  remoteSupportUrl?: string | null;
};

/**
 * Demand-sensing dispute stub — analytics + optional support URL.
 * MUST NOT mutate CS status, evidence, or create dispute rows.
 */
export function useDisputeStub() {
  const { trackEvent } = useAnalytics();

  const openDisputeStub = (args: OpenDisputeStubArgs) => {
    trackEvent(DISPUTE_STUB_ANALYTICS_EVENT, {
      contracted_service_id: args.contractedServiceId,
      cs_status: args.csStatus,
    });

    const url = resolveDisputeSupportUrl(args.remoteSupportUrl ?? null);
    if (!url) {
      toast.message("Em breve", {
        description: "Fale com o suporte Renovi para abrir uma disputa.",
      });
      return { openedUrl: false as const };
    }

    try {
      openExternalSupportUrl(url);
      return { openedUrl: true as const };
    } catch {
      toast.message("Em breve", {
        description: "Fale com o suporte Renovi para abrir uma disputa.",
      });
      return { openedUrl: false as const };
    }
  };

  return { openDisputeStub };
}
