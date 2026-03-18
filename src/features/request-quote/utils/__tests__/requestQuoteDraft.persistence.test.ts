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

    it("roundtrips step4Data with location", () => {
      const draft = {
        ...createMinimalDraft(),
        step4Data: {
          kind: "new" as const,
          formData: {
            address_label: "Casa",
            address_zip: "88015-100",
            address_street: "Rua Y",
            address_number: "20",
            address_complement: "",
            address_neighborhood_id: "n1",
            address_neighborhood: "Centro",
            address_state_id: "s1",
            address_state: "SC",
            address_city_id: "c1",
            address_city: "Florianópolis",
          },
          location: { latitude: -27.59, longitude: -48.54 },
        },
      };
      saveDraft(draft);
      const got = getDraft();
      expect(got?.draft.step4Data).not.toBeNull();
      expect((got?.draft.step4Data as { kind: string; location?: { latitude: number; longitude: number } }).kind).toBe("new");
      expect((got?.draft.step4Data as { location: { latitude: number; longitude: number } }).location).toEqual({
        latitude: -27.59,
        longitude: -48.54,
      });
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
        suggested_equipment: [],
        suggested_materials: [],
        estimated_duration_hint: null,
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

    it("sets step3Data.structured to null when not provided", () => {
      const state = {
        currentStep: 1,
        previousStep: 0,
        selectedService: null,
        step2Data: {},
        step2FormSchema: null,
        step2FormVersion: null,
        step3Data: { description: "only text" },
        step4Data: null,
      };
      const result = buildSerializableDraft(state);
      expect(result.step3Data).toEqual({ description: "only text", structured: null });
    });

    it("preserves step4Data with location when building serializable draft", () => {
      const step4DataWithLocation = {
        kind: "new" as const,
          formData: {
            address_label: "Casa",
            address_zip: "88015-100",
            address_street: "Rua X",
            address_number: "10",
            address_complement: "",
            address_neighborhood_id: "n1",
            address_neighborhood: "Centro",
            address_state_id: "s1",
            address_state: "SC",
            address_city_id: "c1",
            address_city: "Florianópolis",
          },
          location: { latitude: -27.5954, longitude: -48.548 },
      };
      const state = {
        currentStep: 4,
        previousStep: 3,
        selectedService: null,
        step2Data: {},
        step2FormSchema: null,
        step2FormVersion: null,
        step3Data: { description: "" },
        step4Data: step4DataWithLocation,
      };
      const result = buildSerializableDraft(state);
      expect(result.step4Data).toEqual(step4DataWithLocation);
      expect((result.step4Data as typeof step4DataWithLocation).location).toEqual({
        latitude: -27.5954,
        longitude: -48.548,
      });
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
