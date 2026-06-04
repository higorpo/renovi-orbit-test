import { extractDigits } from "./normalize";

const MIN_PHONE_FRAGMENT_LENGTH = 8;
const MAX_PHONE_FRAGMENT_LENGTH = 13;

const MOBILE_WITHOUT_DDD_REGEX = /^9\d{8}$/;
const MOBILE_WITH_DDD_REGEX = /^[1-9]\d9\d{8}$/;
const LANDLINE_WITH_DDD_REGEX = /^[1-9]\d{2}[2-5]\d{7}$/;
const COUNTRY_CODE_REGEX = /^55[1-9]\d{9,10}$/;

function isBrazilianPhoneCandidate(digits: string): boolean {
  if (digits.length < MIN_PHONE_FRAGMENT_LENGTH || digits.length > MAX_PHONE_FRAGMENT_LENGTH) {
    return false;
  }

  if (COUNTRY_CODE_REGEX.test(digits)) return true;
  if (MOBILE_WITH_DDD_REGEX.test(digits)) return true;
  if (LANDLINE_WITH_DDD_REGEX.test(digits)) return true;
  if (MOBILE_WITHOUT_DDD_REGEX.test(digits)) return true;

  if (digits.length >= MIN_PHONE_FRAGMENT_LENGTH && digits.startsWith("9")) {
    return true;
  }

  if (digits.length >= 10 && /^[1-9]\d{8,}$/.test(digits)) {
    return true;
  }

  return false;
}

export function containsPhoneNumberInText(text: string): boolean {
  const digits = extractDigits(text);
  if (!digits) return false;

  if (isBrazilianPhoneCandidate(digits)) return true;

  return scanDigitStreamForPhone(digits);
}

export function containsPhoneNumberAcrossMessages(messages: string[]): boolean {
  const digitChunks = messages
    .map((message) => extractDigits(message))
    .filter((chunk) => chunk.length > 0);

  if (digitChunks.length === 0) return false;

  for (const chunk of digitChunks) {
    if (containsPhoneNumberInText(chunk)) return true;
  }

  const combined = digitChunks.join("");
  if (!combined) return false;

  return scanDigitStreamForPhone(combined);
}

function scanDigitStreamForPhone(digits: string): boolean {
  if (digits.length < MIN_PHONE_FRAGMENT_LENGTH) return false;

  const maxWindow = Math.min(digits.length, MAX_PHONE_FRAGMENT_LENGTH);
  for (let start = 0; start < digits.length; start += 1) {
    for (let length = MIN_PHONE_FRAGMENT_LENGTH; length <= maxWindow; length += 1) {
      const slice = digits.slice(start, start + length);
      if (slice.length < MIN_PHONE_FRAGMENT_LENGTH) continue;
      if (isBrazilianPhoneCandidate(slice)) return true;
    }
  }

  return false;
}
