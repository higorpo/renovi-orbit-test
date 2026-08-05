import { describe, expect, it } from "vitest";
import {
  EMPTY_RATING_SCORES,
  isRatingScoresComplete,
  toServiceRatingScores,
} from "../ServiceRatingForm";

describe("ServiceRatingForm helpers", () => {
  it("blocks incomplete scores", () => {
    expect(isRatingScoresComplete(EMPTY_RATING_SCORES)).toBe(false);
    expect(
      isRatingScoresComplete({
        ...EMPTY_RATING_SCORES,
        quality: 5,
        punctuality: 4,
        communication: 3,
      }),
    ).toBe(false);
  });

  it("accepts all four dimensions", () => {
    const draft = {
      quality: 5,
      punctuality: 4,
      communication: 3,
      value: 5,
      comment: "  ótimo  ",
    };
    expect(isRatingScoresComplete(draft)).toBe(true);
    expect(toServiceRatingScores(draft)).toEqual({
      quality: 5,
      punctuality: 4,
      communication: 3,
      value: 5,
      comment: "ótimo",
    });
  });
});
