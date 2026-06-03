import { describe, expect, it } from "vitest";
import {
  createProviderOwnQuestion,
  createProviderSentBudget,
} from "../../__tests__/fixtures/providerBudgetsFixtures";
import {
  initialProviderJobItemFromOwnQuestion,
  initialProviderJobItemFromSentBudget,
} from "../initialProviderJobItem";

describe("initialProviderJobItem", () => {
  describe("initialProviderJobItemFromSentBudget", () => {
    it("maps budget fields to ProviderJobItem with photos when present", () => {
      const budget = createProviderSentBudget({
        photos: ["a.jpg", "b.jpg"],
        neighborhood: null,
        city: null,
        state_abbr: null,
      });

      const item = initialProviderJobItemFromSentBudget(budget);

      expect(item.id).toBe(budget.service_request_id);
      expect(item.provider_proposal_id).toBe(budget.id);
      expect(item.provider_proposed_amount).toBe(budget.proposed_amount);
      expect(item.provider_proposal_photos).toEqual(["a.jpg", "b.jpg"]);
      expect(item.proposal_count).toBe(1);
      expect(item.neighborhood).toBe("");
      expect(item.city).toBe("");
      expect(item.state).toBe("");
    });

    it("sets proposal photos to null when budget photos are empty", () => {
      const budget = createProviderSentBudget({ photos: [] });
      const item = initialProviderJobItemFromSentBudget(budget);
      expect(item.provider_proposal_photos).toBeNull();
    });
  });

  describe("initialProviderJobItemFromOwnQuestion", () => {
    it("maps question fields and clears proposal-related fields", () => {
      const question = createProviderOwnQuestion({
        neighborhood: "Bairro",
        city: "City",
        state_abbr: "SP",
      });

      const item = initialProviderJobItemFromOwnQuestion(question);

      expect(item.id).toBe(question.service_request_id);
      expect(item.provider_proposal_id).toBeNull();
      expect(item.provider_proposed_amount).toBeNull();
      expect(item.provider_proposal_photos).toBeNull();
      expect(item.neighborhood).toBe("Bairro");
      expect(item.city).toBe("City");
      expect(item.state).toBe("SP");
    });
  });
});
