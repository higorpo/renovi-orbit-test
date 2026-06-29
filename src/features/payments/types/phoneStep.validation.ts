import { z } from "zod";
import { validateBrazilPhone } from "@/lib/validators";

export const phoneStepSchema = z.object({
  phone: z
    .string()
    .min(1, "Informe seu telefone")
    .refine(
      (value) => validateBrazilPhone(value),
      "Telefone inválido. Verifique os números informados.",
    ),
});

export type PhoneStepFormData = z.infer<typeof phoneStepSchema>;
