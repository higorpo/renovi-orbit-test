import { z } from "zod";
import { validateCPF } from "@/lib/validators";

export const cpfStepSchema = z.object({
  cpf: z
    .string()
    .min(1, "Informe seu CPF")
    .refine((value) => validateCPF(value), "CPF inválido. Verifique os números informados."),
});

export type CpfStepFormData = z.infer<typeof cpfStepSchema>;
