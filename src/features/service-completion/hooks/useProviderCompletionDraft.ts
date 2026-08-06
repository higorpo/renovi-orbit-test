// @vitest-environment happy-dom
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { saveEvidenceDraft } from "../api/draft.api";
import { uploadEvidenceFile } from "../api/upload.api";
import { serviceCompletionContextQueryKey } from "./queryKeys";
import type {
  CompletionCriterionResponse,
  CompletionResponsesMap,
  ServiceCompletionContext,
} from "../types/completion.types";

/** Debounce local edits before hitting the network — avoids save spam while answering. */
const DRAFT_SAVE_DEBOUNCE_MS = 1500;
export const DRAFT_VERSION_CONFLICT_CODE = "DRAFT_VERSION_CONFLICT";

export type UseProviderCompletionDraftOptions = {
  serviceRequestId: string;
  context: ServiceCompletionContext | null | undefined;
  /** When false, disables local edits and saves. Default: capabilities.canSaveDraft. */
  enabled?: boolean;
};

export type ProviderDraftSaveState =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "conflict"
  | "error";

function cloneResponses(
  responses: CompletionResponsesMap | null | undefined,
): CompletionResponsesMap {
  if (!responses) return {};
  return structuredClone(responses);
}

function responsesEqual(
  a: CompletionResponsesMap,
  b: CompletionResponsesMap,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isDraftVersionConflict(error: string | null | undefined, errorCode?: string): boolean {
  if (errorCode === DRAFT_VERSION_CONFLICT_CODE) return true;
  return Boolean(error?.includes(DRAFT_VERSION_CONFLICT_CODE));
}

function coerceDraftVersion(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function useProviderCompletionDraft({
  serviceRequestId,
  context,
  enabled,
}: UseProviderCompletionDraftOptions) {
  const queryClient = useQueryClient();
  const canSave = enabled ?? Boolean(context?.capabilities.canSaveDraft);

  const contractedServiceId = context?.contractedService.id ?? null;
  const serverVersion = coerceDraftVersion(context?.evidence.draftVersion);
  const serverResponses = context?.evidence.responses ?? null;

  // Hydrate synchronously on mount so the first keystroke/save never races with
  // draftVersion still being null (CAS treats null as conflict when a row exists).
  const [responses, setResponses] = useState<CompletionResponsesMap>(() =>
    cloneResponses(serverResponses),
  );
  const [draftVersion, setDraftVersion] = useState<number | null>(
    () => serverVersion,
  );
  const [saveState, setSaveState] = useState<ProviderDraftSaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingCriterionId, setUploadingCriterionId] = useState<string | null>(
    null,
  );

  const draftVersionRef = useRef(draftVersion);
  draftVersionRef.current = draftVersion;
  const responsesRef = useRef(responses);
  responsesRef.current = responses;
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;
  const lastPersistedRef = useRef<CompletionResponsesMap>(
    cloneResponses(serverResponses),
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef<CompletionResponsesMap | null>(null);
  const hydratedForCsRef = useRef<string | null>(
    contractedServiceId,
  );

  const applyHydration = (nextResponses: CompletionResponsesMap, version: number | null) => {
    const initial = cloneResponses(nextResponses);
    setResponses(initial);
    responsesRef.current = initial;
    lastPersistedRef.current = cloneResponses(initial);
    setDraftVersion(version);
    draftVersionRef.current = version;
    setSaveError(null);
    setSaveState("idle");
    pendingSaveRef.current = null;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!contractedServiceId || !context) return;

    const firstHydration = hydratedForCsRef.current !== contractedServiceId;
    if (!firstHydration) {
      // Keep typing/saving local work; only adopt newer server snapshots when quiet.
      const quiet =
        saveStateRef.current === "idle" ||
        saveStateRef.current === "saved" ||
        saveStateRef.current === "conflict" ||
        saveStateRef.current === "error";
      if (!quiet) return;
      // Local save bumps draftVersion before React Query/context props catch up —
      // never regress to a stale serverVersion from an unchanged parent prop.
      const serverMovedAhead =
        serverVersion != null &&
        (draftVersionRef.current == null ||
          serverVersion > draftVersionRef.current);
      if (!serverMovedAhead) return;
    }

    applyHydration(serverResponses ?? {}, serverVersion);
    hydratedForCsRef.current = contractedServiceId;
  }, [context, contractedServiceId, serverVersion, serverResponses]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const syncContextCache = (
    nextResponses: CompletionResponsesMap,
    draftVersion: number,
    phase: ServiceCompletionContext["evidence"]["phase"],
  ) => {
    queryClient.setQueryData<ServiceCompletionContext>(
      serviceCompletionContextQueryKey(serviceRequestId),
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          evidence: {
            ...prev.evidence,
            phase: phase === "absent" ? prev.evidence.phase : phase,
            draftVersion,
            responses: cloneResponses(nextResponses),
          },
        };
      },
    );
  };

  const persistDraft = async (seed?: CompletionResponsesMap) => {
    if (!canSave || !contractedServiceId) return;
    if (saveStateRef.current === "conflict") return;

    if (seed) {
      pendingSaveRef.current = seed;
    }

    if (saveInFlightRef.current) {
      setSaveState("dirty");
      return;
    }

    saveInFlightRef.current = true;

    try {
      while (true) {
        const nextResponses =
          pendingSaveRef.current ?? cloneResponses(responsesRef.current);
        pendingSaveRef.current = null;

        if (responsesEqual(nextResponses, lastPersistedRef.current)) {
          setSaveState((prev) =>
            prev === "dirty" || prev === "saving" ? "saved" : prev,
          );
          break;
        }

        setSaveState("saving");
        setSaveError(null);

        const result = await saveEvidenceDraft({
          contractedServiceId,
          responses: nextResponses,
          expectedDraftVersion: draftVersionRef.current,
        });

        if (isDraftVersionConflict(result.error, result.errorCode)) {
          setSaveState("conflict");
          setSaveError(
            "Este rascunho foi atualizado em outro dispositivo. Recarregue para continuar.",
          );
          pendingSaveRef.current = null;
          // Auto-recover: stale CAS after close/reopen should not leave the form locked.
          hydratedForCsRef.current = null;
          void queryClient.invalidateQueries({
            queryKey: serviceCompletionContextQueryKey(serviceRequestId),
          });
          break;
        }

        if (result.error || !result.data) {
          setSaveState("error");
          setSaveError(result.error ?? "Falha ao salvar rascunho");
          toast.error(result.error ?? "Falha ao salvar rascunho");
          break;
        }

        setDraftVersion(result.data.draftVersion);
        draftVersionRef.current = result.data.draftVersion;
        lastPersistedRef.current = cloneResponses(nextResponses);
        // Keep React Query in sync so remounting the dialog does not hydrate a stale CAS version.
        syncContextCache(
          nextResponses,
          result.data.draftVersion,
          result.data.phase,
        );

        // Another edit landed while we were saving — flush the latest snapshot.
        if (pendingSaveRef.current) {
          continue;
        }

        setSaveState("saved");
        break;
      }
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const scheduleSave = (nextResponses: CompletionResponsesMap) => {
    if (!canSave) return;
    if (saveStateRef.current === "conflict") return;
    if (responsesEqual(nextResponses, lastPersistedRef.current)) {
      return;
    }
    setSaveState("dirty");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistDraft(responsesRef.current);
    }, DRAFT_SAVE_DEBOUNCE_MS);
  };

  const setCriterionResponse = (
    criterionId: string,
    value: CompletionCriterionResponse,
  ) => {
    // Always keep local edits (controlled inputs). Persistence is gated by canSave / conflict.
    // Otherwise the textarea looks editable but keystrokes are dropped.
    const next = {
      ...responsesRef.current,
      [criterionId]: value,
    };
    setResponses(next);
    responsesRef.current = next;
    scheduleSave(next);
  };

  const reloadFromServer = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingSaveRef.current = null;
    hydratedForCsRef.current = null;
    setSaveState("idle");
    setSaveError(null);
    await queryClient.invalidateQueries({
      queryKey: serviceCompletionContextQueryKey(serviceRequestId),
    });
  };

  const uploadEvidenceForCriterion = async (
    criterionId: string,
    file: File,
  ): Promise<string | null> => {
    if (!contractedServiceId || saveStateRef.current === "conflict") {
      return null;
    }
    if (!canSave) {
      toast.error("Não é possível anexar fotos neste momento.");
      return null;
    }
    setUploadingCriterionId(criterionId);
    try {
      const result = await uploadEvidenceFile({
        contractedServiceId,
        criterionBlockId: criterionId,
        file,
        idempotencyKey: crypto.randomUUID(),
      });
      if (result.error || !result.path) {
        toast.error(result.error ?? "Falha ao enviar evidência");
        return null;
      }
      return result.path;
    } finally {
      setUploadingCriterionId(null);
    }
  };

  return {
    canSave,
    responses,
    draftVersion,
    saveState,
    saveError,
    uploadingCriterionId,
    setCriterionResponse,
    uploadEvidenceForCriterion,
    reloadFromServer,
    persistNow: () => persistDraft(responsesRef.current),
  };
}
