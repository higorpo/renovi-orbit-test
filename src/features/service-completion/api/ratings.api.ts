/**
 * Optional post-auto-complete rating RPCs (Req 16 / Task 39).
 * Manual confirm uses service_completion_confirm_with_rating (Task 36) instead.
 */

import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

export type ServiceRatingScores = {
  quality: number;
  punctuality: number;
  communication: number;
  value: number;
  comment?: string | null;
};

export type SubmitServiceRatingResult = {
  ratingId: string | null;
  overallScore: number | null;
  error: string | null;
};

function validateScores(scores: ServiceRatingScores): string | null {
  const dims = [scores.quality, scores.punctuality, scores.communication, scores.value];
  if (dims.some((s) => !Number.isInteger(s) || s < 1 || s > 5)) {
    return "Cada nota deve ser um inteiro de 1 a 5.";
  }
  return null;
}

export async function submitServiceRating(
  contractedServiceId: string,
  scores: ServiceRatingScores,
): Promise<SubmitServiceRatingResult> {
  const validationError = validateScores(scores);
  if (validationError) {
    return { ratingId: null, overallScore: null, error: validationError };
  }

  const { data, error } = await supabase.rpc("submit_service_rating", {
    p_contracted_service_id: contractedServiceId,
    p_score_quality: scores.quality,
    p_score_punctuality: scores.punctuality,
    p_score_communication: scores.communication,
    p_score_value: scores.value,
    p_comment: scores.comment?.trim() || undefined,
  });

  if (error) {
    logger.error("submit_service_rating_failed", {
      contractedServiceId,
      error: error.message,
    });
    return { ratingId: null, overallScore: null, error: error.message };
  }

  const row = data as { rating_id?: string; overall_score?: number } | null;
  return {
    ratingId: row?.rating_id ?? null,
    overallScore: row?.overall_score ?? null,
    error: null,
  };
}

export async function updateServiceRating(
  contractedServiceId: string,
  scores: ServiceRatingScores,
): Promise<SubmitServiceRatingResult> {
  const validationError = validateScores(scores);
  if (validationError) {
    return { ratingId: null, overallScore: null, error: validationError };
  }

  const { data, error } = await supabase.rpc("update_service_rating", {
    p_contracted_service_id: contractedServiceId,
    p_score_quality: scores.quality,
    p_score_punctuality: scores.punctuality,
    p_score_communication: scores.communication,
    p_score_value: scores.value,
    p_comment: scores.comment?.trim() || undefined,
  });

  if (error) {
    logger.error("update_service_rating_failed", {
      contractedServiceId,
      error: error.message,
    });
    return { ratingId: null, overallScore: null, error: error.message };
  }

  const row = data as { rating_id?: string; overall_score?: number } | null;
  return {
    ratingId: row?.rating_id ?? null,
    overallScore: row?.overall_score ?? null,
    error: null,
  };
}

export const ratingsApi = {
  submitServiceRating,
  updateServiceRating,
};
