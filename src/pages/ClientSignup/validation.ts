import { z } from "zod";
import { zodIssuesToFieldErrors } from "../Login/validation";

export const signUpSchema = z
  .object({
    fullName: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
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

export type ClientSignupFormData = z.infer<typeof signUpSchema>;

export { zodIssuesToFieldErrors };
