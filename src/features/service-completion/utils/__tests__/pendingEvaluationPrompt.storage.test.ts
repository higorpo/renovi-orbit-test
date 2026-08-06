// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/lib/capacitor/__tests__/preferencesStorage.harness";
import { preferencesGet } from "@/lib/capacitor/preferencesStorage";
import {
  clearPendingEvaluationPromptSnooze,
  isPendingEvaluationPromptSnoozed,
  markPendingEvaluationPromptSnoozed,
  PENDING_EVALUATION_PROMPT_SNOOZE_MS,
} from "../pendingEvaluationPrompt.storage";

describe("pendingEvaluationPrompt.storage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when never snoozed", async () => {
    await expect(isPendingEvaluationPromptSnoozed("sr-1")).resolves.toBe(false);
  });

  it("returns true within snooze cooldown for the same service", async () => {
    await markPendingEvaluationPromptSnoozed("sr-1");
    await expect(isPendingEvaluationPromptSnoozed("sr-1")).resolves.toBe(true);
  });

  it("returns false for a different service request id", async () => {
    await markPendingEvaluationPromptSnoozed("sr-1");
    await expect(isPendingEvaluationPromptSnoozed("sr-2")).resolves.toBe(false);
  });

  it("returns false after snooze cooldown expires", async () => {
    await markPendingEvaluationPromptSnoozed("sr-1");
    vi.advanceTimersByTime(PENDING_EVALUATION_PROMPT_SNOOZE_MS + 1);
    await expect(isPendingEvaluationPromptSnoozed("sr-1")).resolves.toBe(false);
  });

  it("clearPendingEvaluationPromptSnooze removes stored value", async () => {
    await markPendingEvaluationPromptSnoozed("sr-1");
    await clearPendingEvaluationPromptSnooze();
    await expect(isPendingEvaluationPromptSnoozed("sr-1")).resolves.toBe(false);
  });

  it("returns false when preferences read throws", async () => {
    vi.mocked(preferencesGet).mockRejectedValueOnce(new Error("blocked"));
    await expect(isPendingEvaluationPromptSnoozed("sr-1")).resolves.toBe(false);
  });
});
