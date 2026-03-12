import { logger } from "@/lib/logger";
import type { AddressSelection } from "@/features/addresses";
import type { ServiceWithChildren } from "../types/request-quote.types";
import type { ServiceRequestStructuredData } from "../types/request-quote.types";

const STORAGE_KEY = "renovi_request_quote_draft";

/**
 * Bump this version whenever the request-quote flow schema changes (new step,
 * removed/renamed field, or any change to persisted state shape). Old drafts
 * with a different version will not be offered for restore.
 */
export const REQUEST_QUOTE_DRAFT_VERSION = "1";

/** Step 3 persisted subset: description and structured data only (no files). */
export interface SerializableStep3Data {
  description: string;
  structured?: ServiceRequestStructuredData | null;
}

/** Draft state stored in localStorage. Step 5 (personal data) is excluded for security. */
export interface SerializableDraftState {
  currentStep: number;
  previousStep: number;
  selectedService: ServiceWithChildren | null;
  step2Data: Record<string, unknown>;
  step2FormSchema: Record<string, unknown> | null;
  step2FormVersion: string | null;
  step3Data: SerializableStep3Data;
  step4Data: AddressSelection;
}

export interface PersistedDraft {
  version: string;
  draft: SerializableDraftState;
}

export function getDraft(): PersistedDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed != null &&
      typeof parsed === "object" &&
      "version" in parsed &&
      typeof (parsed as PersistedDraft).version === "string" &&
      "draft" in parsed &&
      typeof (parsed as PersistedDraft).draft === "object"
    ) {
      return parsed as PersistedDraft;
    }
    return null;
  } catch (e) {
    logger.debug("request_quote_draft_get_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export function saveDraft(draft: SerializableDraftState): void {
  try {
    const payload: PersistedDraft = {
      version: REQUEST_QUOTE_DRAFT_VERSION,
      draft,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    logger.debug("request_quote_draft_save_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Builds the serializable draft from full request-quote state (step3: description + structured only).
 * Step 5 (personal data) is intentionally omitted from persistence.
 */
export function buildSerializableDraft(state: {
  currentStep: number;
  previousStep: number;
  selectedService: ServiceWithChildren | null;
  step2Data: Record<string, unknown>;
  step2FormSchema: Record<string, unknown> | null;
  step2FormVersion: string | null;
  step3Data: { description: string; structured?: ServiceRequestStructuredData | null };
  step4Data: AddressSelection;
}): SerializableDraftState {
  return {
    currentStep: state.currentStep,
    previousStep: state.previousStep,
    selectedService: state.selectedService,
    step2Data: state.step2Data,
    step2FormSchema: state.step2FormSchema,
    step2FormVersion: state.step2FormVersion,
    step3Data: {
      description: state.step3Data.description,
      structured: state.step3Data.structured ?? null,
    },
    step4Data: state.step4Data,
  };
}
