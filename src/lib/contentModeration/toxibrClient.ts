import { createFilter, type FilterResult, type ToxiBRFilter } from "toxibr";

/**
 * Terms that ToxiBR treats as context-sensitive but Orbit always blocks in UGC.
 */
const ORBIT_EXTRA_BLOCKED_WORDS = [
  "porra",
  "caralho",
  "cacete",
  "merda",
  "bosta",
  "putaria",
  "foda",
  "foder",
  "fodase",
  "foda-se",
] as const;

/**
 * Shared ToxiBR filter for Orbit user-generated text.
 * Split phone detection across chat messages stays in phoneNumber.ts.
 */
export const orbitContentFilter: ToxiBRFilter = createFilter({
  extraBlockedWords: [...ORBIT_EXTRA_BLOCKED_WORDS],
  blockLinks: false,
  blockPhones: true,
  blockDigitsOnly: false,
  blockEmojis: false,
});

export function filterWithToxibr(text: string): FilterResult {
  return orbitContentFilter(text);
}
