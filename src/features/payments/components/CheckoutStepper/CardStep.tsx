import { useEffect, useRef, type ReactNode } from "react";
import { logger } from "@/lib/logger";
import { issueClearSaleSession } from "../../api/clearsale.api";
import type { ClearSaleSessionPurpose } from "../../api/clearsale.api";
import { injectClearSaleSdk } from "../../utils/injectClearSaleSdk";
import { isClearSaleProductionFailClosed } from "../../utils/isClearSaleProductionFailClosed";

export type CardStepProps = {
  purpose: ClearSaleSessionPurpose;
  proposalId?: string;
  scheduleId?: string;
  onSessionIdGenerated: (sessionId: string | null) => void;
  children?: ReactNode;
};

export function CardStep({
  purpose,
  proposalId,
  scheduleId,
  onSessionIdGenerated,
  children,
}: CardStepProps) {
  const onSessionIdGeneratedRef = useRef(onSessionIdGenerated);
  onSessionIdGeneratedRef.current = onSessionIdGenerated;

  useEffect(() => {
    let cancelled = false;
    let cleanupSdk: (() => void) | undefined;

    const unlockSession = (sessionId: string | null) => {
      if (!cancelled) {
        onSessionIdGeneratedRef.current(sessionId);
      }
    };

    const failClosedOrDegrade = (sessionId: string | null, reason: string) => {
      logger.warn(reason, {
        purpose,
        proposal_id: proposalId,
        schedule_id: scheduleId,
        session_id: sessionId,
      });
      // Production: never unlock confirm without a live ClearSale SDK (CHK-011).
      unlockSession(isClearSaleProductionFailClosed() ? null : sessionId);
    };

    void (async () => {
      const issued = await issueClearSaleSession({
        purpose,
        proposalId,
        scheduleId,
      });

      if (cancelled) {
        return;
      }

      if (!issued.sessionId) {
        failClosedOrDegrade(null, "clearsale_issue_session_unavailable");
        return;
      }

      const sessionId = issued.sessionId;
      const appKey = import.meta.env.VITE_CLEARSALE_APP_KEY?.trim() ?? "";
      if (!appKey) {
        failClosedOrDegrade(sessionId, "clearsale_app_key_missing");
        return;
      }

      cleanupSdk = injectClearSaleSdk({
        sessionId,
        appKey,
        onInitialized: () => {
          unlockSession(sessionId);
        },
        onLoadFailed: () => {
          failClosedOrDegrade(sessionId, "clearsale_sdk_load_failed");
        },
      });
    })();

    return () => {
      cancelled = true;
      cleanupSdk?.();
    };
  }, [purpose, proposalId, scheduleId]);

  return <div data-testid="checkout-card-step">{children}</div>;
}
