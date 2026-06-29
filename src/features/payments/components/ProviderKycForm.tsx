import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { maskCNPJ, maskCPF, maskPhone } from "@/lib/masks";
import { uploadKycDocument } from "../api/kyc.api";
import { KYC_DOCUMENT_ACCEPT } from "../constants/kyc.constants";
import { useDispatchKyc } from "../hooks/useDispatchKyc";
import {
  providerKycCnpjSchema,
  providerKycCpfSchema,
  type KycEntityType,
  type ProviderKycCnpjFormData,
  type ProviderKycCpfFormData,
} from "../types/providerKyc.validation";
export type ProviderKycFormProps = {
  providerId: string;
  accountEmail: string;
  defaultPhone?: string;
  onSubmitted?: () => void;
};

type FormValues = {
  entityType: KycEntityType;
  fullName: string;
  document: string;
  phone: string;
  email: string;
  bankInstitutionCode: string;
  bankBranch: string;
  bankAccount: string;
  pixKey: string;
  razaoSocial: string;
  nomeFantasia: string;
  legalRepFullName: string;
  legalRepCpf: string;
  legalRepPhone: string;
  identityDoc: File | null;
  addressProofDoc: File | null;
  corporateCharterDoc: File | null;
  legalRepDoc: File | null;
};

const defaultValues: FormValues = {
  entityType: "CPF",
  fullName: "",
  document: "",
  phone: "",
  email: "",
  bankInstitutionCode: "",
  bankBranch: "",
  bankAccount: "",
  pixKey: "",
  razaoSocial: "",
  nomeFantasia: "",
  legalRepFullName: "",
  legalRepCpf: "",
  legalRepPhone: "",
  identityDoc: null,
  addressProofDoc: null,
  corporateCharterDoc: null,
  legalRepDoc: null,
};

function FileField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="file"
        accept={KYC_DOCUMENT_ACCEPT}
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {value ? (
        <p className="text-xs text-muted-foreground">{value.name}</p>
      ) : null}
    </div>
  );
}

export function ProviderKycForm({
  providerId,
  accountEmail,
  defaultPhone,
  onSubmitted,
}: ProviderKycFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dispatchKyc = useDispatchKyc();

  const form = useForm<FormValues>({
    defaultValues: {
      ...defaultValues,
      email: accountEmail,
      phone: defaultPhone ?? "",
    },
    mode: "onSubmit",
  });

  const entityType = form.watch("entityType");
  const isCnpj = entityType === "CNPJ";

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    const parsed = values.entityType === "CPF"
      ? providerKycCpfSchema.safeParse({
          ...values,
          identityDoc: values.identityDoc,
          addressProofDoc: values.addressProofDoc,
        })
      : providerKycCnpjSchema.safeParse({
          ...values,
          identityDoc: values.identityDoc,
          addressProofDoc: values.addressProofDoc,
          corporateCharterDoc: values.corporateCharterDoc,
          legalRepDoc: values.legalRepDoc,
        });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      form.setError(firstIssue.path[0] as keyof FormValues, {
        message: firstIssue.message,
      });
      return;
    }

    const data = parsed.data as ProviderKycCpfFormData | ProviderKycCnpjFormData;

    try {
      const uploads = await Promise.all([
        uploadKycDocument(providerId, "identity", data.identityDoc),
        uploadKycDocument(providerId, "address-proof", data.addressProofDoc),
        ...(data.entityType === "CNPJ"
          ? [
              uploadKycDocument(providerId, "corporate-charter", data.corporateCharterDoc),
              uploadKycDocument(providerId, "legal-rep-doc", data.legalRepDoc),
            ]
          : []),
      ]);

      const failedUpload = uploads.find((upload) => upload.error || !upload.signedUrl);
      if (failedUpload) {
        throw new Error(failedUpload.error ?? "Falha ao enviar documentos");
      }

      const [identity, addressProof, corporateCharter, legalRepDoc] = uploads;

      await dispatchKyc.mutateAsync({
        entityType: data.entityType,
        fullName: data.fullName,
        document: data.document,
        phone: data.phone,
        email: data.email,
        bankInstitutionCode: data.bankInstitutionCode,
        bankBranch: data.bankBranch,
        bankAccount: data.bankAccount,
        pixKey: data.pixKey,
        identityDocUrl: identity.signedUrl!,
        addressProofUrl: addressProof.signedUrl!,
        ...(data.entityType === "CNPJ"
          ? {
              razaoSocial: data.razaoSocial,
              nomeFantasia: data.nomeFantasia,
              legalRepFullName: data.legalRepFullName,
              legalRepCpf: data.legalRepCpf,
              legalRepPhone: data.legalRepPhone,
              corporateCharterUrl: corporateCharter?.signedUrl ?? undefined,
              legalRepDocUrl: legalRepDoc?.signedUrl ?? undefined,
            }
          : {}),
      });

      onSubmitted?.();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Falha ao enviar credenciamento");
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Credenciamento de pagamentos</h1>
          <p className="text-sm text-muted-foreground">
            Complete seus dados para receber pagamentos pelos serviços prestados na Renovi.
          </p>
        </div>

        <FormField
          control={form.control}
          name="entityType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de cadastro</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as KycEntityType)}
                  className="grid grid-cols-2 gap-3"
                >
                  <Label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                    <RadioGroupItem value="CPF" />
                    Pessoa física (CPF)
                  </Label>
                  <Label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                    <RadioGroupItem value="CNPJ" />
                    Pessoa jurídica (CNPJ)
                  </Label>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Nome completo</FormLabel>
                <FormControl>
                  <Input {...field} disabled={dispatchKyc.isPending} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="document"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{isCnpj ? "CNPJ" : "CPF"}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={dispatchKyc.isPending}
                    onChange={(event) => {
                      const value = isCnpj
                        ? maskCNPJ(event.target.value)
                        : maskCPF(event.target.value);
                      field.onChange(value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={dispatchKyc.isPending}
                    onChange={(event) => field.onChange(maskPhone(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input {...field} readOnly disabled />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isCnpj ? (
          <div className="grid gap-4 sm:grid-cols-2" data-testid="kyc-cnpj-fields">
            <FormField
              control={form.control}
              name="razaoSocial"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Razão social</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={dispatchKyc.isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nomeFantasia"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nome fantasia</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={dispatchKyc.isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legalRepFullName"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nome do representante legal</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={dispatchKyc.isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legalRepCpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF do representante</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={dispatchKyc.isPending}
                      onChange={(event) => field.onChange(maskCPF(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legalRepPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone do representante</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={dispatchKyc.isPending}
                      onChange={(event) => field.onChange(maskPhone(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="bankInstitutionCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Banco</FormLabel>
                <FormControl>
                  <Input {...field} disabled={dispatchKyc.isPending} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bankBranch"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agência</FormLabel>
                <FormControl>
                  <Input {...field} disabled={dispatchKyc.isPending} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bankAccount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conta</FormLabel>
                <FormControl>
                  <Input {...field} disabled={dispatchKyc.isPending} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pixKey"
            render={({ field }) => (
              <FormItem className="sm:col-span-3">
                <FormLabel>Chave PIX (opcional)</FormLabel>
                <FormControl>
                  <Input {...field} disabled={dispatchKyc.isPending} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="identityDoc"
            render={({ field }) => (
              <FormItem>
                <FileField
                  id="kyc-identity-doc"
                  label="Documento de identidade (CPF/CNH)"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={dispatchKyc.isPending}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="addressProofDoc"
            render={({ field }) => (
              <FormItem>
                <FileField
                  id="kyc-address-proof"
                  label="Comprovante de endereço"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={dispatchKyc.isPending}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          {isCnpj ? (
            <>
              <FormField
                control={form.control}
                name="corporateCharterDoc"
                render={({ field }) => (
                  <FormItem>
                    <FileField
                      id="kyc-corporate-charter"
                      label="Contrato social"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={dispatchKyc.isPending}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="legalRepDoc"
                render={({ field }) => (
                  <FormItem>
                    <FileField
                      id="kyc-legal-rep-doc"
                      label="Documento do representante legal"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={dispatchKyc.isPending}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}
        </div>

        {submitError ? (
          <p className="text-sm text-destructive" role="alert">
            {submitError}
          </p>
        ) : null}

        <Button type="submit" disabled={dispatchKyc.isPending} className="w-full sm:w-auto">
          {dispatchKyc.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Enviando credenciamento…
            </>
          ) : (
            "Enviar credenciamento"
          )}
        </Button>
      </form>
    </Form>
  );
}
