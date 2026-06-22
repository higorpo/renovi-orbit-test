/**
 * Brazilian CNPJ helpers (numeric and alphanumeric, RFB Jul/2026+).
 * Check digits use modulo 11 with ASCII code minus 48 for each body character.
 */

const CNPJ_REGEX = /^[A-Z0-9]{12}[0-9]{2}$/;

/** Strip punctuation, uppercase, keep alphanumerics only (max 14 chars). */
export function normalizeCNPJ(value: string): string {
  return value
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 14);
}

function cnpjCharValue(char: string): number {
  return char.charCodeAt(0) - 48;
}

function cnpjWeights(length: number): number[] {
  const weights: number[] = [];
  let weight = length === 12 ? 5 : 6;
  for (let i = 0; i < length; i++) {
    weights.push(weight);
    weight = weight === 2 ? 9 : weight - 1;
  }
  return weights;
}

function calculateCNPJCheckDigit(base: string): number {
  const weights = cnpjWeights(base.length);
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    sum += cnpjCharValue(base[i]) * weights[i];
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Validates numeric and alphanumeric CNPJ (14 chars, modulo-11 check digits). */
export function validateCNPJ(cnpj: string): boolean {
  const normalized = normalizeCNPJ(cnpj);
  if (!CNPJ_REGEX.test(normalized)) return false;

  const body = normalized.slice(0, 12);
  const checkDigits = normalized.slice(12, 14);

  if (/^([A-Z0-9])\1{11}$/.test(body)) return false;

  const digit1 = calculateCNPJCheckDigit(body);
  if (digit1 !== Number(checkDigits[0])) return false;

  const digit2 = calculateCNPJCheckDigit(body + String(digit1));
  return digit2 === Number(checkDigits[1]);
}
