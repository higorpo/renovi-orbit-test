import type { MutableRefObject } from "react";
import { stableStringify } from "./stableStringify";

/** Max AI description attempts per mount (1 initial + 2 retries). */
export const MAX_SMART_DESCRIPTION_ATTEMPTS = 3;

/**
 * After a failed smart-description generation, either clear the step2 snapshot (so the user can retry)
 * or lock it (after max attempts) to stop further API calls for the same mount.
 */
export function updateSnapshotAfterSmartDescriptionFailure(options: {
  attemptCount: number;
  step2Data: Record<string, unknown>;
  step2DataSnapshotRef: MutableRefObject<string | null>;
}): void {
  const { attemptCount, step2Data, step2DataSnapshotRef } = options;
  if (attemptCount < MAX_SMART_DESCRIPTION_ATTEMPTS) {
    step2DataSnapshotRef.current = null;
  } else {
    step2DataSnapshotRef.current = stableStringify(step2Data);
  }
}
