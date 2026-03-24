import { z } from "zod";

export { zodIssuesToFieldErrors } from "./validation.utils";

const FULL_NAME_ERROR = "Informe nome e sobrenome";

export function validateFullName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Nome é obrigatório";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return FULL_NAME_ERROR;
  return null;
}

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Nome é obrigatório")
      .refine(
        (val) => val.trim().split(/\s+/).filter(Boolean).length >= 2,
        FULL_NAME_ERROR
      ),
    email: z.string().email("Email inválido"),
    password: z.string().min(10, "Senha deve ter no mínimo 10 caracteres"),
    confirmPassword: z.string(),
    termsAccepted: z
      .boolean()
      .refine((val) => val === true, "Você deve aceitar os termos"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type SignupFormData = z.infer<typeof signUpSchema>;
