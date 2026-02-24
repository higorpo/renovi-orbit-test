import { z } from "zod";

export { zodIssuesToFieldErrors } from "./validation.utils";

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
