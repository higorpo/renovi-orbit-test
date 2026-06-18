import { useAuth } from "@/features/auth";
import { logger } from "@/lib/logger";
import { useEffect, useRef } from "react";
import { recordProviderOpportunityView } from "../api/opportunityView.api";

export function useRecordProviderOpportunityView(
  serviceRequestId: string | undefined,
): void {
  const { profile } = useAuth();
  const recordedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!serviceRequestId || profile?.role !== "provider") {
      return;
    }

    if (recordedRef.current === serviceRequestId) {
      return;
    }

    recordedRef.current = serviceRequestId;

    void recordProviderOpportunityView(serviceRequestId).catch((err) => {
      logger.warn("record_provider_opportunity_view_failed", {
        err,
        serviceRequestId,
      });
    });
  }, [serviceRequestId, profile?.role]);
}
