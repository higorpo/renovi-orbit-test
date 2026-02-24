import { z } from "zod";

export { zodIssuesToFieldErrors } from "./validation.utils";

export const signInSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export type SignInFormData = z.infer<typeof signInSchema>;
