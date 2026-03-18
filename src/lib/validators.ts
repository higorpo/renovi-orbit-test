/**
 * Common validators (CPF, etc.). Pure functions, no I/O.
 */

export function validateCPF(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, "");
  if (numbers.length !== 11) return false;
  const invalidPatterns = [
    "00000000000", "11111111111", "22222222222", "33333333333",
    "44444444444", "55555555555", "66666666666", "77777777777",
    "88888888888", "99999999999",
  ];
  if (invalidPatterns.includes(numbers)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(numbers[i], 10) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(numbers[i], 10) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[10], 10)) return false;
  return true;
}

/** Brazilian CNPJ: 14 digits, basic format check. */
export function validateCNPJ(cnpj: string): boolean {
  const numbers = cnpj.replace(/\D/g, "");
  if (numbers.length !== 14) return false;
  const invalidPatterns = [
    "00000000000000", "11111111111111", "22222222222222", "33333333333333",
    "44444444444444", "55555555555555", "66666666666666", "77777777777777",
    "88888888888888", "99999999999999",
  ];
  if (invalidPatterns.includes(numbers)) return false;
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(numbers[i], 10) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(numbers[12], 10)) return false;
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(numbers[i], 10) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(numbers[13], 10)) return false;
  return true;
}

/** Brazilian phone: 10 digits (landline) or 11 digits (mobile). */
export function validateBrazilPhone(phone: string): boolean {
  const numbers = phone.replace(/\D/g, "");
  return numbers.length === 10 || numbers.length === 11;
}
