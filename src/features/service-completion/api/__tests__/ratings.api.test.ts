import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitServiceRating, updateServiceRating } from "../ratings.api";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

describe("ratings.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submitServiceRating rejects out-of-range scores before RPC", async () => {
    const result = await submitServiceRating("cs-1", {
      quality: 6,
      punctuality: 5,
      communication: 5,
      value: 5,
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(result.error).toMatch(/1 a 5/);
  });

  it("submitServiceRating calls submit_service_rating RPC", async () => {
    rpc.mockResolvedValue({
      data: { rating_id: "r-1", overall_score: 4.5 },
      error: null,
    });

    const result = await submitServiceRating("cs-1", {
      quality: 5,
      punctuality: 4,
      communication: 5,
      value: 4,
      comment: " ótimo ",
    });

    expect(rpc).toHaveBeenCalledWith("submit_service_rating", {
      p_contracted_service_id: "cs-1",
      p_score_quality: 5,
      p_score_punctuality: 4,
      p_score_communication: 5,
      p_score_value: 4,
      p_comment: "ótimo",
    });
    expect(result).toEqual({
      ratingId: "r-1",
      overallScore: 4.5,
      error: null,
    });
  });

  it("updateServiceRating calls update_service_rating RPC", async () => {
    rpc.mockResolvedValue({
      data: { rating_id: "r-1", overall_score: 4.2 },
      error: null,
    });

    const result = await updateServiceRating("cs-1", {
      quality: 4,
      punctuality: 4,
      communication: 4,
      value: 5,
    });

    expect(rpc).toHaveBeenCalledWith("update_service_rating", {
      p_contracted_service_id: "cs-1",
      p_score_quality: 4,
      p_score_punctuality: 4,
      p_score_communication: 4,
      p_score_value: 5,
      p_comment: null,
    });
    expect(result.ratingId).toBe("r-1");
    expect(result.error).toBeNull();
  });
});
