import { z } from "zod";
import { validateCPF, validateCNPJ } from "@/lib/validators";

export const KYC_WIZARD_STEPS = [
  "entity",
  "identity",
  "bank",
  "documents",
  "review",
] as const;

export type KycWizardStep = (typeof KYC_WIZARD_STEPS)[number];

export const entityStepSchema = z.object({
  entityType: z.enum(["CPF", "CNPJ"]),
});

const bankFields = {
  bankInstitutionCode: z.string().trim().min(1, "Selecione o banco"),
  bankBranch: z
    .string()
    .trim()
    .min(1, "Informe a agência")
    .regex(/^\d+$/, "Informe apenas os números da agência (sem dígito)"),
  bankAccount: z.string().trim().min(1, "Informe a conta com dígito"),
  pixKey: z.string().trim().optional(),
};

export const identityStepCpfSchema = z.object({
  entityType: z.literal("CPF"),
  fullName: z.string().trim().min(3, "Informe o nome completo"),
  document: z
    .string()
    .trim()
    .refine(validateCPF, "CPF inválido"),
  phone: z.string().trim().min(10, "Informe o telefone"),
  email: z.string().trim().email("E-mail inválido"),
});

export const identityStepCnpjSchema = identityStepCpfSchema.extend({
  entityType: z.literal("CNPJ"),
  document: z
    .string()
    .trim()
    .refine(validateCNPJ, "CNPJ inválido"),
  razaoSocial: z.string().trim().min(3, "Informe a razão social"),
  nomeFantasia: z.string().trim().min(2, "Informe o nome fantasia"),
  legalRepFullName: z.string().trim().min(3, "Informe o nome do representante"),
  legalRepCpf: z
    .string()
    .trim()
    .refine(validateCPF, "CPF do representante inválido"),
  legalRepPhone: z.string().trim().min(10, "Informe o telefone do representante"),
});

export const bankStepSchema = z.object(bankFields);

export const documentsStepCpfSchema = z.object({
  identityDoc: z.custom<File>((value) => value instanceof File, "Envie o documento de identidade"),
  addressProofDoc: z.custom<File>((value) => value instanceof File, "Envie o comprovante de endereço"),
});

/** PJ: legal-rep ID replaces PF identity; address-proof is the company address. */
export const documentsStepCnpjSchema = z.object({
  legalRepDoc: z.custom<File>(
    (value) => value instanceof File,
    "Envie o documento do representante",
  ),
  addressProofDoc: z.custom<File>(
    (value) => value instanceof File,
    "Envie o comprovante de endereço da empresa",
  ),
  corporateCharterDoc: z.custom<File>(
    (value) => value instanceof File,
    "Envie o contrato social",
  ),
});

export const providerKycCpfSchema = identityStepCpfSchema
  .merge(bankStepSchema)
  .merge(documentsStepCpfSchema);

export const providerKycCnpjSchema = identityStepCnpjSchema
  .merge(bankStepSchema)
  .merge(documentsStepCnpjSchema);

export type ProviderKycCpfFormData = z.infer<typeof providerKycCpfSchema>;
export type ProviderKycCnpjFormData = z.infer<typeof providerKycCnpjSchema>;
export type ProviderKycFormData = ProviderKycCpfFormData | ProviderKycCnpjFormData;

export type KycEntityType = ProviderKycFormData["entityType"];

/** Maps form entity type to RPC `p_entity_type` (`pf` | `pj`). */
export function toRpcEntityType(entityType: KycEntityType): "pf" | "pj" {
  return entityType === "CPF" ? "pf" : "pj";
}

export function fromRpcEntityType(entityType: string | null | undefined): KycEntityType | null {
  const normalized = entityType?.trim().toLowerCase();
  if (normalized === "pf") return "CPF";
  if (normalized === "pj") return "CNPJ";
  return null;
}
