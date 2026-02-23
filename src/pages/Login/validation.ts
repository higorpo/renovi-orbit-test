import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export type SignInFormData = z.infer<typeof signInSchema>;

/**
 * Maps Zod validation issues to a record of field names and error messages.
 */
export function zodIssuesToFieldErrors(
  issues: z.ZodIssue[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
