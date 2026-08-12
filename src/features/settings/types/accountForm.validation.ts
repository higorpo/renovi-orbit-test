import { z } from "zod";
import { validateFullName } from "@/features/auth";
import { validateCPF, validateBrazilPhone } from "@/lib/validators";
import { maskCPF } from "@/lib/masks";

const FULL_NAME_MESSAGE = "Informe seu nome completo com nome e sobrenome";

export const accountFormSchema = z.object({
  full_name: z
    .string()
    .min(1, "Nome é obrigatório")
    .refine((val) => validateFullName(val) === null, FULL_NAME_MESSAGE),
  phone: z
    .string()
    .refine((val) => !val.trim() || validateBrazilPhone(val), "Telefone inválido"),
  cpf: z
    .string()
    .refine((val) => !val.trim() || validateCPF(val), "CPF inválido"),
});

export type AccountFormData = z.infer<typeof accountFormSchema>;

export function defaultAccountFormData(profile: {
  full_name: string;
  phone?: string | null;
  cpf?: string | null;
}): AccountFormData {
  return {
    full_name: profile.full_name.trim(),
    phone: profile.phone ?? "",
    cpf: profile.cpf ? maskCPF(profile.cpf) : "",
  };
}
