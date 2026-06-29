export function normalizeCardDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskCardNumber(value: string): string {
  const digits = normalizeCardDigits(value).slice(0, 16);
  const groups: string[] = [];

  for (let index = 0; index < digits.length; index += 4) {
    groups.push(digits.slice(index, index + 4));
  }

  return groups.join(" ");
}

export function isValidLuhn(cardNumber: string): boolean {
  const digits = normalizeCardDigits(cardNumber);

  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number.parseInt(digits[index] ?? "0", 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export function isValidCardExpiry(expiryMonth: number, expiryYear: number): boolean {
  if (!Number.isFinite(expiryMonth) || expiryMonth < 1 || expiryMonth > 12) {
    return false;
  }

  if (!Number.isFinite(expiryYear) || expiryYear < 2000) {
    return false;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (expiryYear < currentYear) {
    return false;
  }

  if (expiryYear === currentYear && expiryMonth < currentMonth) {
    return false;
  }

  return true;
}

export function normalizeExpiryYear(value: string | number): number {
  const digits = String(value).replace(/\D/g, "");

  if (digits.length === 2) {
    return 2000 + Number.parseInt(digits, 10);
  }

  return Number.parseInt(digits, 10);
}

export function isValidCvv(cvv: string): boolean {
  const digits = normalizeCardDigits(cvv);
  return digits.length === 3 || digits.length === 4;
}
