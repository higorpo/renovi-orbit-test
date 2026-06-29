import { useEffect, useRef, type ReactNode } from "react";
import { logger } from "@/lib/logger";
import { generateClearSaleSessionId } from "../../utils/generateClearSaleSessionId";
import { injectClearSaleSdk } from "../../utils/injectClearSaleSdk";

export type CardStepProps = {
  onSessionIdGenerated: (sessionId: string) => void;
  children?: ReactNode;
};

export function CardStep({ onSessionIdGenerated, children }: CardStepProps) {
  const clearsaleSessionIdRef = useRef<string>(generateClearSaleSessionId());
  const onSessionIdGeneratedRef = useRef(onSessionIdGenerated);
  onSessionIdGeneratedRef.current = onSessionIdGenerated;

  useEffect(() => {
    const sessionId = clearsaleSessionIdRef.current;
    onSessionIdGeneratedRef.current(sessionId);

    const appKey = import.meta.env.VITE_CLEARSALE_APP_KEY?.trim() ?? "";
    if (!appKey) {
      logger.warn("clearsale_app_key_missing", { session_id: sessionId });
      return;
    }

    return injectClearSaleSdk({
      sessionId,
      appKey,
      onLoadFailed: () => {
        logger.warn("clearsale_sdk_load_failed", { session_id: sessionId });
      },
    });
  }, []);

  return <div data-testid="checkout-card-step">{children}</div>;
}
