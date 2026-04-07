import { describe, it, expect } from "vitest";
import {
  MAX_SMART_DESCRIPTION_ATTEMPTS,
  updateSnapshotAfterSmartDescriptionFailure,
} from "../step3SmartDescriptionSnapshot";
import { stableStringify } from "../stableStringify";

describe("step3SmartDescriptionSnapshot", () => {
  it("clears snapshot when attempt count is below max", () => {
    const ref: { current: string | null } = { current: "was-set" };
    updateSnapshotAfterSmartDescriptionFailure({
      attemptCount: 1,
      step2Data: { a: 1 },
      step2DataSnapshotRef: ref,
    });
    expect(ref.current).toBeNull();
  });

  it("locks snapshot to stable step2 string when attempt count reached max", () => {
    const ref: { current: string | null } = { current: null };
    const step2Data = { x: 2 };
    updateSnapshotAfterSmartDescriptionFailure({
      attemptCount: MAX_SMART_DESCRIPTION_ATTEMPTS,
      step2Data,
      step2DataSnapshotRef: ref,
    });
    expect(ref.current).toBe(stableStringify(step2Data));
  });

  it("clears snapshot when attempt is one below max", () => {
    const ref: { current: string | null } = { current: "old" };
    updateSnapshotAfterSmartDescriptionFailure({
      attemptCount: MAX_SMART_DESCRIPTION_ATTEMPTS - 1,
      step2Data: {},
      step2DataSnapshotRef: ref,
    });
    expect(ref.current).toBeNull();
  });
});
