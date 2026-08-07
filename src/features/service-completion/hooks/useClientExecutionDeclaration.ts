// @vitest-environment happy-dom
import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { recordExecutionDeclaration } from "../api/declaration.api";
import { collectDeviceDeclarationPayload } from "../utils/collectDeviceDeclarationPayload";

const DEBOUNCE_MS = 500;

const PERSIST_ERROR_MESSAGE =
  "Não foi possível registrar sua declaração. Remarque a caixa para tentar novamente.";

export type UseClientExecutionDeclarationOptions = {
  contractedServiceId: string;
  enabled: boolean;
};

export type UseClientExecutionDeclarationResult = {
  checked: boolean;
  setChecked: (next: boolean) => void;
  declarationPersisted: boolean;
  isPersisting: boolean;
  error: string | null;
};

/**
 * Hard-gate helper for the execution declaration checkbox.
 * Debounces persist on check; uncheck cancels pending timer but does not clear DB.
 * After a successful persist in this mount, further checks are no-ops for network.
 */
export function useClientExecutionDeclaration({
  contractedServiceId,
  enabled,
}: UseClientExecutionDeclarationOptions): UseClientExecutionDeclarationResult {
  const [checked, setCheckedState] = useState(false);
  const [declarationPersisted, setDeclarationPersisted] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const contractedServiceIdRef = useRef(contractedServiceId);
  contractedServiceIdRef.current = contractedServiceId;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const persist = useCallback(async () => {
    if (!enabled) return;
    if (syncedRef.current) {
      setDeclarationPersisted(true);
      setError(null);
      return;
    }
    if (inFlightRef.current) {
      await inFlightRef.current;
      return;
    }

    const run = (async () => {
      setIsPersisting(true);
      setError(null);
      try {
        const device = await collectDeviceDeclarationPayload();
        const result = await recordExecutionDeclaration({
          contractedServiceId: contractedServiceIdRef.current,
          ...device,
        });
        if (result.error || !result.data) {
          syncedRef.current = false;
          setDeclarationPersisted(false);
          setError(PERSIST_ERROR_MESSAGE);
          logger.warn("client_execution_declaration_persist_failed", {
            feature: "service_completion",
            contracted_service_id: contractedServiceIdRef.current,
            error: result.error,
          });
          return;
        }
        syncedRef.current = true;
        setDeclarationPersisted(true);
        setError(null);
      } catch (err) {
        syncedRef.current = false;
        setDeclarationPersisted(false);
        setError(PERSIST_ERROR_MESSAGE);
        logger.error("client_execution_declaration_persist_exception", {
          feature: "service_completion",
          contracted_service_id: contractedServiceIdRef.current,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsPersisting(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    await run;
  }, [enabled]);

  const setChecked = useCallback(
    (next: boolean) => {
      setCheckedState(next);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (!enabled) {
        return;
      }

      if (!next) {
        // Uncheck cancels pending persist; does not clear DB or syncedRef.
        setIsPersisting(false);
        return;
      }

      if (syncedRef.current) {
        setDeclarationPersisted(true);
        setError(null);
        return;
      }

      setDeclarationPersisted(false);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void persist();
      }, DEBOUNCE_MS);
    },
    [enabled, persist],
  );

  return {
    checked,
    setChecked,
    declarationPersisted,
    isPersisting,
    error,
  };
}
