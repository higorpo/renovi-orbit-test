import type { FilterReason, FilterResult } from "toxibr";
import { getContentModerationMessage } from "./messages";
import type { ContentModerationResult, ContentModerationViolation } from "./types";

const PHONE_FILTER_REASONS = new Set<FilterReason>(["phone", "digits_only"]);

function resolveViolation(reason: FilterReason): ContentModerationViolation {
  return PHONE_FILTER_REASONS.has(reason) ? "phone" : "profanity";
}

export function mapToxibrResultToContentModeration(
  result: FilterResult,
): ContentModerationResult {
  if (result.allowed) {
    return { allowed: true, violation: null, message: null };
  }

  const violation = resolveViolation(result.reason);

  return {
    allowed: false,
    violation,
    message: getContentModerationMessage(violation),
  };
}
