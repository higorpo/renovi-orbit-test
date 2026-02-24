const COMMON_PASSWORDS = [
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "12345",
  "654321",
  "111111",
  "000000",
  "senha",
  "senha123",
  "password",
  "password123",
  "qwerty",
  "admin",
  "admin123",
  "renovi",
  "renovi123",
];

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: number;
}

export function validatePasswordStrength(
  password: string
): PasswordValidationResult {
  const errors: string[] = [];
  let strength = 0;
  const trimmed = password.trim();

  if (trimmed.length < 10) {
    errors.push("Senha deve ter no mínimo 10 caracteres");
  } else strength++;

  if (!/[A-Z]/.test(trimmed)) {
    errors.push("Senha deve ter pelo menos 1 letra maiúscula");
  } else strength++;

  if (!/[a-z]/.test(trimmed)) {
    errors.push("Senha deve ter pelo menos 1 letra minúscula");
  } else strength++;

  if (!/[0-9]/.test(trimmed)) {
    errors.push("Senha deve ter pelo menos 1 número");
  } else strength++;

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(trimmed)) {
    errors.push(
      "Senha deve ter pelo menos 1 caractere especial (!@#$%^&* etc.)"
    );
  } else strength++;

  if (COMMON_PASSWORDS.includes(trimmed.toLowerCase())) {
    errors.push("Esta senha é muito comum e não é permitida");
    strength = Math.max(0, strength - 2);
  }

  return {
    valid: errors.length === 0,
    errors,
    strength: Math.min(5, strength),
  };
}

export function getPasswordStrengthLabel(strength: number): string {
  switch (strength) {
    case 0:
    case 1:
      return "Muito fraca";
    case 2:
      return "Fraca";
    case 3:
      return "Média";
    case 4:
      return "Forte";
    case 5:
      return "Muito forte";
    default:
      return "Desconhecido";
  }
}

export function getPasswordStrengthColor(strength: number): string {
  switch (strength) {
    case 0:
    case 1:
      return "bg-red-500";
    case 2:
      return "bg-orange-500";
    case 3:
      return "bg-yellow-500";
    case 4:
      return "bg-green-500";
    case 5:
      return "bg-emerald-500";
    default:
      return "bg-gray-300";
  }
}

export const PASSWORD_REQUIREMENTS = [
  {
    label: "Mínimo 10 caracteres",
    test: (p: string) => p.length >= 10,
  },
  { label: "1 letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "1 letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "1 número", test: (p: string) => /[0-9]/.test(p) },
  {
    label: "1 caractere especial",
    test: (p: string) =>
      /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(p),
  },
];
