import { mapToxibrResultToContentModeration } from "./mapToxibrResult";
import { containsPhoneNumberAcrossMessages, containsPhoneNumberInText } from "./phoneNumber";
import { getContentModerationMessage } from "./messages";
import { filterWithToxibr } from "./toxibrClient";
import type { ContentModerationResult } from "./types";

export function moderateTextContent(text: string): ContentModerationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { allowed: true, violation: null, message: null };
  }

  const toxibrResult = mapToxibrResultToContentModeration(filterWithToxibr(trimmed));
  if (!toxibrResult.allowed) {
    return toxibrResult;
  }

  if (containsPhoneNumberInText(trimmed)) {
    return {
      allowed: false,
      violation: "phone",
      message: getContentModerationMessage("phone"),
    };
  }

  return { allowed: true, violation: null, message: null };
}

export function moderateTextWithRecentMessages(
  text: string,
  recentMessages: string[],
): ContentModerationResult {
  const single = moderateTextContent(text);
  if (!single.allowed) return single;

  const trimmed = text.trim();
  const history = [...recentMessages, ...(trimmed ? [trimmed] : [])];

  if (containsPhoneNumberAcrossMessages(history)) {
    return {
      allowed: false,
      violation: "phone",
      message: getContentModerationMessage("phone"),
    };
  }

  return { allowed: true, violation: null, message: null };
}
