import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ServiceRequestStructuredData } from "../../types/request-quote.types";
import {
  getDraft,
  saveDraft,
  clearDraft,
  buildSerializableDraft,
  REQUEST_QUOTE_DRAFT_VERSION,
} from "../requestQuoteDraft.persistence";

const STORAGE_KEY = "renovi_request_quote_draft";

function createMinimalDraft() {
  return {
    currentStep: 1,
    previousStep: 0,
    selectedService: null,
    step2Data: {},
    step2FormSchema: null,
    step2FormVersion: null,
    step3Data: { description: "" },
    step4Data: null,
  };
}

describe("requestQuoteDraft.persistence", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });
  });

  describe("getDraft", () => {
    it("returns null when storage is empty", () => {
      expect(getDraft()).toBeNull();
    });

    it("returns null when stored value is invalid JSON", () => {
      storage[STORAGE_KEY] = "not json";
      expect(getDraft()).toBeNull();
    });

    it("returns null when stored value has no version", () => {
      storage[STORAGE_KEY] = JSON.stringify({ draft: createMinimalDraft() });
      expect(getDraft()).toBeNull();
    });

    it("returns null when stored value has no draft", () => {
      storage[STORAGE_KEY] = JSON.stringify({ version: "2" });
      expect(getDraft()).toBeNull();
    });

    it("returns parsed draft when storage has valid payload", () => {
      const draft = createMinimalDraft();
      saveDraft(draft);
      const got = getDraft();
      expect(got).not.toBeNull();
      expect(got?.version).toBe(REQUEST_QUOTE_DRAFT_VERSION);
      expect(got?.draft).toEqual(draft);
    });
  });

  describe("saveDraft", () => {
    it("writes version and draft to storage", () => {
      const draft = createMinimalDraft();
      saveDraft(draft);
      const raw = storage[STORAGE_KEY];
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!) as { version: string; draft: unknown };
      expect(parsed.version).toBe(REQUEST_QUOTE_DRAFT_VERSION);
      expect(parsed.draft).toEqual(draft);
    });

    it("roundtrips with getDraft", () => {
      const draft = createMinimalDraft();
      (draft as unknown as { currentStep: number }).currentStep = 2;
      (draft as unknown as { step3Data: { description: string } }).step3Data.description = "test desc";
      saveDraft(draft);
      const got = getDraft();
      expect(got?.draft.currentStep).toBe(2);
      expect(got?.draft.step3Data.description).toBe("test desc");
    });
  });

  describe("clearDraft", () => {
    it("removes key from storage", () => {
      saveDraft(createMinimalDraft());
      expect(getDraft()).not.toBeNull();
      clearDraft();
      expect(getDraft()).toBeNull();
    });
  });

  describe("buildSerializableDraft", () => {
    it("maps state to serializable draft with step3 description and structured only (no step5)", () => {
      const structured: ServiceRequestStructuredData = {
        urgency: "high",
        scope_complexity: "medium",
        suggested_questions: [],
        tags: [],
        missing_info_warnings: [],
      };
      const state = {
        currentStep: 2,
        previousStep: 1,
        selectedService: null,
        step2Data: { a: 1 },
        step2FormSchema: { version: "v1" },
        step2FormVersion: "v1",
        step3Data: {
          description: "desc",
          structured,
        },
        step4Data: null,
      };
      const result = buildSerializableDraft(state);
      expect(result.currentStep).toBe(2);
      expect(result.step2Data).toEqual({ a: 1 });
      expect(result.step3Data).toEqual({ description: "desc", structured });
      expect(result).not.toHaveProperty("step5Data");
    });
  });

  describe("version compatibility", () => {
    it("getDraft returns payload with stored version so hook can compare to REQUEST_QUOTE_DRAFT_VERSION", () => {
      storage[STORAGE_KEY] = JSON.stringify({
        version: "0",
        draft: createMinimalDraft(),
      });
      const got = getDraft();
      expect(got).not.toBeNull();
      expect(got?.version).toBe("0");
      expect(got?.version).not.toBe(REQUEST_QUOTE_DRAFT_VERSION);
    });
  });
});
