import { useId, useRef } from "react";
import { FileText, HelpCircle, Loader2, Upload } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { maskCNPJ, maskCPF, maskPhone } from "@/lib/masks";
import { cn } from "@/lib/utils";
import {
  KYC_DOCUMENT_ACCEPT,
  PROVIDER_KYC_HELP_MAILTO,
} from "../constants/kyc.constants";
import {
  findBrazilianBankByCode,
  formatBankLabel,
} from "../constants/brazilianBanks";
import { useBrazilianBanks } from "../hooks/useBrazilianBanks";
import type { KycWizardStep } from "../types/providerKyc.validation";
import type { ProviderKycWizardFormValues } from "../hooks/useProviderKycWizard";
import { BankPicker } from "./BankPicker";

function FileField({
  id,
  label,
  helper,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  helper: string;
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const describedById = useId();

  return (
    <div className="space-y-2">
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <FormDescription id={describedById}>{helper}</FormDescription>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={KYC_DOCUMENT_ACCEPT}
        disabled={disabled}
        className="sr-only"
        aria-describedby={describedById}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-md border border-input bg-background px-3 text-left text-base transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "hover:bg-muted/40",
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {value ? <FileText className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          {value ? (
            <>
              <span className="block truncate font-medium text-foreground">{value.name}</span>
              <span className="block text-xs text-muted-foreground md:hidden">
                Toque para trocar o arquivo
              </span>
              <span className="hidden text-xs text-muted-foreground md:block">
                Clique para trocar o arquivo
              </span>
            </>
          ) : (
            <>
              <span className="block font-medium text-foreground">Escolher arquivo</span>
              <span className="block text-xs text-muted-foreground md:hidden">
                Toque para selecionar
              </span>
              <span className="hidden text-xs text-muted-foreground md:block">
                Clique para selecionar
              </span>
            </>
          )}
        </span>
      </button>
    </div>
  );
}

function EntityCard({
  selected,
  title,
  description,
  onSelect,
  disabled,
}: {
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "min-h-[5.5rem] rounded-xl border p-4 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-foreground bg-muted/40"
          : "border-border hover:border-foreground/40",
      )}
      aria-pressed={selected}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

function StepPanel({
  active,
  testId,
  children,
}: {
  active: boolean;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className={cn("space-y-4", !active && "hidden")}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

export type ProviderKycWizardStepContentProps = {
  step: KycWizardStep;
  form: UseFormReturn<ProviderKycWizardFormValues>;
  isCnpj: boolean;
  disabled?: boolean;
};

export function ProviderKycWizardStepContent({
  step,
  form,
  isCnpj,
  disabled,
}: ProviderKycWizardStepContentProps) {
  // Keep all fields mounted so RHF retains values across wizard steps.
  const values = form.watch();
  const banksQuery = useBrazilianBanks();
  const bank = findBrazilianBankByCode(
    values.bankInstitutionCode,
    banksQuery.data ?? [],
  );

  return (
    <>
      <StepPanel active={step === "entity"} testId="kyc-step-entity">
        <p className="text-sm text-muted-foreground">
          Escolha como você atua na Renovi. Isso define quais documentos e dados
          bancários pediremos a seguir.
        </p>
        <FormField
          control={form.control}
          name="entityType"
          render={({ field }) => (
            <FormItem>
              <div className="grid gap-3 sm:grid-cols-2">
                <EntityCard
                  selected={field.value === "CPF"}
                  title="Pessoa física (CPF)"
                  description="Para profissionais autônomos que recebem no CPF."
                  onSelect={() => field.onChange("CPF")}
                  disabled={disabled}
                />
                <EntityCard
                  selected={field.value === "CNPJ"}
                  title="Pessoa jurídica (CNPJ)"
                  description="Para empresas e MEIs que emitem nota ou operam com CNPJ."
                  onSelect={() => field.onChange("CNPJ")}
                  disabled={disabled}
                />
              </div>
            </FormItem>
          )}
        />
      </StepPanel>

      <StepPanel active={step === "identity"} testId="kyc-step-identity">
        <p className="text-sm text-muted-foreground">
          Usamos esses dados para validar sua identidade e garantir a segurança
          da plataforma para você e para os clientes.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Nome completo</FormLabel>
                <FormControl>
                  <Input {...field} disabled={disabled} className="min-h-11" />
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
                    disabled={disabled}
                    className="min-h-11"
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
                    disabled={disabled}
                    className="min-h-11"
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
                <FormDescription>
                  E-mail cadastrado na plataforma. Não é possível alterar aqui.
                </FormDescription>
                <FormControl>
                  <Input {...field} readOnly disabled className="min-h-11" />
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
                    <Input {...field} disabled={disabled} className="min-h-11" />
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
                    <Input {...field} disabled={disabled} className="min-h-11" />
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
                    <Input {...field} disabled={disabled} className="min-h-11" />
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
                      disabled={disabled}
                      className="min-h-11"
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
                      disabled={disabled}
                      className="min-h-11"
                      onChange={(event) => field.onChange(maskPhone(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}
      </StepPanel>

      <StepPanel active={step === "bank"} testId="kyc-step-bank">
        <p className="text-sm text-muted-foreground">
          Conta onde você receberá os pagamentos dos serviços. A agência é só o
          número (sem dígito verificador).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="bankInstitutionCode"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Banco</FormLabel>
                <FormControl>
                  <BankPicker
                    id="kyc-bank-picker"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                    aria-invalid={Boolean(form.formState.errors.bankInstitutionCode)}
                  />
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
                <FormDescription>Apenas números, sem dígito</FormDescription>
                <FormControl>
                  <Input
                    {...field}
                    inputMode="numeric"
                    disabled={disabled}
                    className="min-h-11"
                    onChange={(event) =>
                      field.onChange(event.target.value.replace(/\D/g, ""))
                    }
                  />
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
                <FormLabel>Conta com dígito</FormLabel>
                <FormDescription>Ex.: 12345-6</FormDescription>
                <FormControl>
                  <Input {...field} disabled={disabled} className="min-h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pixKey"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Chave PIX (opcional)</FormLabel>
                <FormDescription>
                  Facilita conciliações futuras. Você pode deixar em branco.
                </FormDescription>
                <FormControl>
                  <Input {...field} disabled={disabled} className="min-h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </StepPanel>

      <StepPanel active={step === "documents"} testId="kyc-step-documents">
        <p className="text-sm text-muted-foreground">
          Envie documentos legíveis para concluirmos a verificação de segurança
          da sua conta na Renovi.
        </p>
        {isCnpj ? (
          <>
            <FormField
              control={form.control}
              name="legalRepDoc"
              render={({ field }) => (
                <FormItem>
                  <FileField
                    id="kyc-legal-rep-id"
                    label="Documento do representante legal"
                    helper="RG ou CNH do responsável legal pela empresa."
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
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
                    label="Comprovante de endereço da empresa"
                    helper="Conta de luz, água ou extrato recente em nome da empresa."
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="corporateCharterDoc"
              render={({ field }) => (
                <FormItem>
                  <FileField
                    id="kyc-corporate-charter"
                    label="Contrato social"
                    helper="Documento que comprova a constituição da empresa."
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : (
          <>
            <FormField
              control={form.control}
              name="identityDoc"
              render={({ field }) => (
                <FormItem>
                  <FileField
                    id="kyc-identity-doc"
                    label="Documento de identidade (CPF/CNH)"
                    helper="Comprova sua identidade para uso da plataforma."
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
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
                    helper="Conta de luz, água ou extrato recente em seu nome."
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        <a
          href={PROVIDER_KYC_HELP_MAILTO}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
          Precisa de ajuda?
        </a>
      </StepPanel>

      <StepPanel active={step === "review"} testId="kyc-step-review">
        <p className="text-sm text-muted-foreground">
          Confira os dados antes de enviar. Após o envio, nossa equipe analisa o
          cadastro para liberar o uso da plataforma.
        </p>
        <dl className="space-y-3 rounded-xl border p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd className="font-medium">
              {isCnpj ? "Pessoa jurídica (CNPJ)" : "Pessoa física (CPF)"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nome</dt>
            <dd className="font-medium">{values.fullName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{isCnpj ? "CNPJ" : "CPF"}</dt>
            <dd className="font-medium">{values.document}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Telefone</dt>
            <dd className="font-medium">{values.phone}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium">{values.email}</dd>
          </div>
          {isCnpj ? (
            <>
              <div>
                <dt className="text-muted-foreground">Razão social</dt>
                <dd className="font-medium">{values.razaoSocial}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Representante</dt>
                <dd className="font-medium">{values.legalRepFullName}</dd>
              </div>
            </>
          ) : null}
          <div>
            <dt className="text-muted-foreground">Banco</dt>
            <dd className="font-medium">
              {bank ? formatBankLabel(bank) : values.bankInstitutionCode}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Agência / Conta</dt>
            <dd className="font-medium">
              {values.bankBranch} / {values.bankAccount}
            </dd>
          </div>
          {values.pixKey ? (
            <div>
              <dt className="text-muted-foreground">PIX</dt>
              <dd className="font-medium">{values.pixKey}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">Documentos</dt>
            <dd className="font-medium">
              {[
                isCnpj ? values.legalRepDoc?.name : values.identityDoc?.name,
                values.addressProofDoc?.name,
                isCnpj ? values.corporateCharterDoc?.name : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        </dl>
      </StepPanel>
    </>
  );
}

export function WizardFooterPendingLabel() {
  return (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
      Enviando…
    </>
  );
}
