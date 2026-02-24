import { z } from "zod";
import { zodIssuesToFieldErrors } from "../Login/validation";

export const resetPasswordSchema = z
  .object({
    password: z.string().min(10, "Senha deve ter no mínimo 10 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export { zodIssuesToFieldErrors };
