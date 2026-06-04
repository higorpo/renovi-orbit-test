const ACCENT_STRIP_REGEX = /[\u0300-\u036f]/g;

const LEET_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/[@]/g, "a"],
  [/[$]/g, "s"],
  [/0/g, "o"],
  [/1/g, "i"],
  [/3/g, "e"],
  [/4/g, "a"],
  [/5/g, "s"],
  [/7/g, "t"],
  [/8/g, "b"],
];

const PORTUGUESE_NUMBER_WORD_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bzero\b/g, "0"],
  [/\buma?\b/g, "1"],
  [/\bdois\b/g, "2"],
  [/\bduas\b/g, "2"],
  [/\btres\b/g, "3"],
  [/\bquatro\b/g, "4"],
  [/\bcinco\b/g, "5"],
  [/\bseis\b/g, "6"],
  [/\bmeia\b/g, "6"],
  [/\bsete\b/g, "7"],
  [/\boito\b/g, "8"],
  [/\bnove\b/g, "9"],
  [/\bdez\b/g, "10"],
];

export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(ACCENT_STRIP_REGEX, "");
}

function applyPortugueseNumberWords(value: string): string {
  let normalized = value;
  for (const [pattern, replacement] of PORTUGUESE_NUMBER_WORD_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

function applyLeetToLetterRuns(value: string): string {
  return value.replace(/[a-z0-9]*[a-z][a-z0-9]*/gi, (run) => {
    let normalized = run.toLowerCase();
    for (const [pattern, replacement] of LEET_REPLACEMENTS) {
      normalized = normalized.replace(pattern, replacement);
    }
    return normalized;
  });
}

export function normalizeForModeration(value: string): string {
  const base = applyPortugueseNumberWords(stripDiacritics(value.toLowerCase()));
  return applyLeetToLetterRuns(base);
}

export function compactLettersAndDigits(value: string): string {
  return normalizeForModeration(value).replace(/[^a-z0-9]/g, "");
}

export function extractDigits(value: string): string {
  const base = applyPortugueseNumberWords(stripDiacritics(value.toLowerCase()));
  return base.replace(/\D/g, "");
}

export function collapseRepeatedLetters(value: string, maxRepeat = 2): string {
  return value.replace(/(.)\1{2,}/g, (_, char: string) => char.repeat(maxRepeat));
}
