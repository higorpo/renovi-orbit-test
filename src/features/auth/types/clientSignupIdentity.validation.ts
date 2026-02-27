import { z } from "zod";

/**
 * Schema for inline client signup (e.g. request-quote flow) with first/last name.
 * Use signUpSchema in types/clientSignup.validation.ts for the standalone signup page (fullName).
 */
export const clientSignupIdentitySchema = z
  .object({
    firstName: z.string().min(2, "Nome muito curto"),
    lastName: z.string().min(2, "Sobrenome muito curto"),
    email: z.string().email("Email inválido"),
    password: z.string().min(10, "Senha deve ter no mínimo 10 caracteres"),
    confirmPassword: z.string(),
    termsAccepted: z.boolean().refine((v) => v === true, "Você deve aceitar os termos"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type ClientSignupIdentityData = z.infer<typeof clientSignupIdentitySchema>;

export const defaultClientSignupIdentity: ClientSignupIdentityData = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
};

/** Build fullName for signUp from identity data. */
export function identityToFullName(data: ClientSignupIdentityData): string {
  return `${data.firstName.trim()} ${data.lastName.trim()}`.trim();
}
