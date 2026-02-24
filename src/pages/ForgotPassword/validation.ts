import { z } from "zod";
import { zodIssuesToFieldErrors } from "../Login/validation";

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export { zodIssuesToFieldErrors };
