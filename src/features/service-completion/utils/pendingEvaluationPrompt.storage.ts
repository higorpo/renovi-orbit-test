import {
  preferencesGet,
  preferencesRemove,
  preferencesSet,
} from "@/lib/capacitor/preferencesStorage";

const STORAGE_KEY = "orbit_pending_evaluation_prompt_snooze";

/** After dismiss (X), do not re-prompt the same service until cooldown expires. */
export const PENDING_EVALUATION_PROMPT_SNOOZE_MS = 4 * 60 * 60 * 1000;

type SnoozeRecord = {
  serviceRequestId: string;
  snoozedAt: string;
};

async function readSnooze(): Promise<SnoozeRecord | null> {
  try {
    const raw = await preferencesGet(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SnoozeRecord;
    if (
      typeof parsed?.serviceRequestId !== "string" ||
      typeof parsed?.snoozedAt !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function isPendingEvaluationPromptSnoozed(
  serviceRequestId: string,
): Promise<boolean> {
  const record = await readSnooze();
  if (!record || record.serviceRequestId !== serviceRequestId) return false;

  const snoozedAt = new Date(record.snoozedAt).getTime();
  if (Number.isNaN(snoozedAt)) return false;

  return Date.now() - snoozedAt < PENDING_EVALUATION_PROMPT_SNOOZE_MS;
}

export async function markPendingEvaluationPromptSnoozed(
  serviceRequestId: string,
): Promise<void> {
  const record: SnoozeRecord = {
    serviceRequestId,
    snoozedAt: new Date().toISOString(),
  };
  await preferencesSet(STORAGE_KEY, JSON.stringify(record));
}

export async function clearPendingEvaluationPromptSnooze(): Promise<void> {
  await preferencesRemove(STORAGE_KEY);
}
