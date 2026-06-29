export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function isValidCpf(cpf: string): boolean {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number.parseInt(digits[index]!, 10) * (10 - index);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number.parseInt(digits[9]!, 10)) return false;

  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += Number.parseInt(digits[index]!, 10) * (11 - index);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === Number.parseInt(digits[10]!, 10);
}
