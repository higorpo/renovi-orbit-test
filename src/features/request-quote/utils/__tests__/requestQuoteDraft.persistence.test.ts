// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ServiceRequestStructuredData } from "../../types/request-quote.types";
import "@/lib/capacitor/__tests__/preferencesStorage.harness";
import { clearPreferencesTestStore, getPreferencesTestStore } from "@/lib/capacitor/__tests__/preferencesStorage.harness";
import { preferencesSet } from "@/lib/capacitor/preferencesStorage";
import {
  getDraft,
  saveDraft,
  clearDraft,
  buildSerializableDraft,
  REQUEST_QUOTE_DRAFT_VERSION,
} from "../requestQuoteDraft.persistence";

const STORAGE_KEY = "prestway_request_quote_draft";

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
  beforeEach(() => {
    clearPreferencesTestStore();
  });

  describe("getDraft", () => {
    it("returns null when storage is empty", async () => {
      await expect(getDraft()).resolves.toBeNull();
    });

    it("returns null when stored value is invalid JSON", async () => {
      getPreferencesTestStore()[STORAGE_KEY] = "not json";
      await expect(getDraft()).resolves.toBeNull();
    });

    it("returns null when JSON.parse throws a non-Error value", async () => {
      const spy = vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
        throw "parse boom";
      });
      getPreferencesTestStore()[STORAGE_KEY] = '{"version":"1"}';
      await expect(getDraft()).resolves.toBeNull();
      spy.mockRestore();
    });

    it("returns null when stored value has no version", async () => {
      getPreferencesTestStore()[STORAGE_KEY] = JSON.stringify({ draft: createMinimalDraft() });
      await expect(getDraft()).resolves.toBeNull();
    });

    it("returns null when stored value has no draft", async () => {
      getPreferencesTestStore()[STORAGE_KEY] = JSON.stringify({ version: "2" });
      await expect(getDraft()).resolves.toBeNull();
    });

    it("returns null when version is not a string", async () => {
      getPreferencesTestStore()[STORAGE_KEY] = JSON.stringify({
        version: 1,
        draft: createMinimalDraft(),
      });
      await expect(getDraft()).resolves.toBeNull();
    });

    it("returns null when draft is not an object", async () => {
      getPreferencesTestStore()[STORAGE_KEY] = JSON.stringify({
        version: "1",
        draft: "invalid",
      });
      await expect(getDraft()).resolves.toBeNull();
    });

    it("returns parsed draft when storage has valid payload", async () => {
      const draft = createMinimalDraft();
      await saveDraft(draft);
      const got = await getDraft();
      expect(got).not.toBeNull();
      expect(got?.version).toBe(REQUEST_QUOTE_DRAFT_VERSION);
      expect(got?.draft).toEqual(draft);
    });
  });

  describe("saveDraft", () => {
    it("writes version and draft to storage", async () => {
      const draft = createMinimalDraft();
      await saveDraft(draft);
      const raw = getPreferencesTestStore()[STORAGE_KEY];
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!) as { version: string; draft: unknown };
      expect(parsed.version).toBe(REQUEST_QUOTE_DRAFT_VERSION);
      expect(parsed.draft).toEqual(draft);
    });

    it("roundtrips with getDraft", async () => {
      const draft = createMinimalDraft();
      (draft as unknown as { currentStep: number }).currentStep = 2;
      (draft as unknown as { step3Data: { description: string } }).step3Data.description =
        "test desc";
      await saveDraft(draft);
      const got = await getDraft();
      expect(got?.draft.currentStep).toBe(2);
      expect(got?.draft.step3Data.description).toBe("test desc");
    });

    it("roundtrips step4Data with location", async () => {
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
      await saveDraft(draft);
      const got = await getDraft();
      expect(got?.draft.step4Data).not.toBeNull();
      expect(
        (got?.draft.step4Data as { kind: string; location?: { latitude: number; longitude: number } })
          .kind,
      ).toBe("new");
      expect(
        (got?.draft.step4Data as { location: { latitude: number; longitude: number } }).location,
      ).toEqual({
        latitude: -27.59,
        longitude: -48.54,
      });
    });
  });

  describe("clearDraft", () => {
    it("removes key from storage", async () => {
      await saveDraft(createMinimalDraft());
      expect(await getDraft()).not.toBeNull();
      await clearDraft();
      expect(await getDraft()).toBeNull();
    });

    it("does not throw when remove fails", async () => {
      const { preferencesRemove } = await import("@/lib/capacitor/preferencesStorage");
      vi.mocked(preferencesRemove).mockRejectedValueOnce(new Error("remove failed"));
      await expect(clearDraft()).resolves.toBeUndefined();
    });
  });

  describe("saveDraft errors", () => {
    it("does not throw when set fails", async () => {
      vi.mocked(preferencesSet).mockRejectedValueOnce(new Error("quota exceeded"));
      await expect(saveDraft(createMinimalDraft())).resolves.toBeUndefined();
    });
  });

  describe("buildSerializableDraft", () => {
    it("maps state to serializable draft with step3 description and structured only (no step5)", () => {
      const structured: ServiceRequestStructuredData = {
        urgency: "high",
        scope_complexity: "medium",
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
      expect(result.step3Data).toEqual({
        description: "desc",
        suggestedTitle: null,
        structured,
      });
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
      expect(result.step3Data).toEqual({
        description: "only text",
        suggestedTitle: null,
        structured: null,
      });
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
    it("getDraft returns payload with stored version so hook can compare to REQUEST_QUOTE_DRAFT_VERSION", async () => {
      getPreferencesTestStore()[STORAGE_KEY] = JSON.stringify({
        version: "0",
        draft: createMinimalDraft(),
      });
      const got = await getDraft();
      expect(got).not.toBeNull();
      expect(got?.version).toBe("0");
      expect(got?.version).not.toBe(REQUEST_QUOTE_DRAFT_VERSION);
    });
  });
});
