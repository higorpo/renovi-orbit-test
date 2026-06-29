import { z } from "zod";
import { validateCPF, validateCNPJ } from "@/lib/validators";

const bankFields = {
  bankInstitutionCode: z.string().trim().min(1, "Informe o código do banco"),
  bankBranch: z.string().trim().min(1, "Informe a agência"),
  bankAccount: z.string().trim().min(1, "Informe a conta"),
  pixKey: z.string().trim().optional(),
};

const documentFields = {
  identityDoc: z.custom<File>((value) => value instanceof File, "Envie o documento de identidade"),
  addressProofDoc: z.custom<File>((value) => value instanceof File, "Envie o comprovante de endereço"),
};

export const providerKycCpfSchema = z.object({
  entityType: z.literal("CPF"),
  fullName: z.string().trim().min(3, "Informe o nome completo"),
  document: z
    .string()
    .trim()
    .refine(validateCPF, "CPF inválido"),
  phone: z.string().trim().min(10, "Informe o telefone"),
  email: z.string().trim().email("E-mail inválido"),
  ...bankFields,
  ...documentFields,
});

export const providerKycCnpjSchema = providerKycCpfSchema.extend({
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
  corporateCharterDoc: z.custom<File>(
    (value) => value instanceof File,
    "Envie o contrato social",
  ),
  legalRepDoc: z.custom<File>(
    (value) => value instanceof File,
    "Envie o documento do representante",
  ),
});

export type ProviderKycCpfFormData = z.infer<typeof providerKycCpfSchema>;
export type ProviderKycCnpjFormData = z.infer<typeof providerKycCnpjSchema>;
export type ProviderKycFormData = ProviderKycCpfFormData | ProviderKycCnpjFormData;

export type KycEntityType = ProviderKycFormData["entityType"];
