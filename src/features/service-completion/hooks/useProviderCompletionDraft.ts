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

const DRAFT_SAVE_DEBOUNCE_MS = 800;
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

function isDraftVersionConflict(error: string | null | undefined, errorCode?: string): boolean {
  if (errorCode === DRAFT_VERSION_CONFLICT_CODE) return true;
  return Boolean(error?.includes(DRAFT_VERSION_CONFLICT_CODE));
}

export function useProviderCompletionDraft({
  serviceRequestId,
  context,
  enabled,
}: UseProviderCompletionDraftOptions) {
  const queryClient = useQueryClient();
  const canSave = enabled ?? Boolean(context?.capabilities.canSaveDraft);

  const contractedServiceId = context?.contractedService.id ?? null;
  const serverVersion = context?.evidence.draftVersion ?? null;
  const serverResponses = context?.evidence.responses ?? null;

  const [responses, setResponses] = useState<CompletionResponsesMap>({});
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<ProviderDraftSaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingCriterionId, setUploadingCriterionId] = useState<string | null>(
    null,
  );

  const draftVersionRef = useRef(draftVersion);
  draftVersionRef.current = draftVersion;
  const responsesRef = useRef(responses);
  responsesRef.current = responses;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedForCsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!contractedServiceId || !context) return;
    if (hydratedForCsRef.current === contractedServiceId) return;

    setResponses(cloneResponses(serverResponses));
    setDraftVersion(serverVersion);
    setSaveError(null);
    setSaveState("idle");
    hydratedForCsRef.current = contractedServiceId;
  }, [context, contractedServiceId, serverVersion, serverResponses]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const persistDraft = async (nextResponses: CompletionResponsesMap) => {
    if (!canSave || !contractedServiceId) return;
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
      return;
    }

    if (result.error || !result.data) {
      setSaveState("error");
      setSaveError(result.error ?? "Falha ao salvar rascunho");
      toast.error(result.error ?? "Falha ao salvar rascunho");
      return;
    }

    setDraftVersion(result.data.draftVersion);
    draftVersionRef.current = result.data.draftVersion;
    setSaveState("saved");
  };

  const scheduleSave = (nextResponses: CompletionResponsesMap) => {
    if (!canSave) return;
    setSaveState("dirty");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistDraft(nextResponses);
    }, DRAFT_SAVE_DEBOUNCE_MS);
  };

  const setCriterionResponse = (
    criterionId: string,
    value: CompletionCriterionResponse,
  ) => {
    if (!canSave || saveState === "conflict") return;
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
    if (!canSave || !contractedServiceId || saveState === "conflict") {
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
