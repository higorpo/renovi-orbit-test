/**
 * Common validators (CPF, etc.). Pure functions, no I/O.
 */

export { validateCNPJ } from "@/lib/cnpj";

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

/** Brazilian phone: 10 digits (landline) or 11 digits (mobile). */
export function validateBrazilPhone(phone: string): boolean {
  const numbers = phone.replace(/\D/g, "");
  return numbers.length === 10 || numbers.length === 11;
}
