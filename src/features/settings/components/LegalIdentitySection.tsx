import type { ReactNode } from "react";
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
import { maskCPF, maskCNPJ } from "@/lib/masks";
import type { ProviderAccountFormData } from "../types/providerAccountForm.validation";
import type { EntityType } from "./EntityTypeSection";

export interface LegalIdentitySectionProps {
  form: UseFormReturn<ProviderAccountFormData>;
  entityType: EntityType;
  disabled?: boolean;
}

function FieldGroup({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="w-full space-y-1">
        <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">
          {legend}
        </span>
        {description ? (
          <span className="block text-sm font-normal leading-relaxed text-body">
            {description}
          </span>
        ) : null}
      </legend>
      {children}
    </fieldset>
  );
}

export function LegalIdentitySection({
  form,
  entityType,
  disabled,
}: LegalIdentitySectionProps) {
  return (
    <div className="rounded-2xl border border-border bg-canvas p-4 shadow-sm sm:p-5">
      {entityType === "pf" ? (
        <FieldGroup
          legend="Documento"
          description="Usado na verificação da conta, em conformidade com a LGPD."
        >
          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000.000.000-00"
                    disabled={disabled}
                    onChange={(e) => field.onChange(maskCPF(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FieldGroup>
      ) : (
        <div className="space-y-6">
          <FieldGroup
            legend="Empresa"
            description="Dados da pessoa jurídica usados em contratos e fiscal."
          >
            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="00.000.000/0000-00"
                      disabled={disabled}
                      onChange={(e) => field.onChange(maskCNPJ(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="razao_social"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razão social</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="organization"
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nome_fantasia"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome fantasia</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={disabled} />
                  </FormControl>
                  <FormDescription>Como a empresa é conhecida no dia a dia.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FieldGroup>

          <div className="border-t border-border" />

          <FieldGroup
            legend="Representante legal"
            description="Pessoa responsável pela empresa perante a Prestway."
          >
            <FormField
              control={form.control}
              name="legal_representative_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="name"
                      disabled={disabled}
                      placeholder="Nome e sobrenome"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legal_representative_cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="000.000.000-00"
                      disabled={disabled}
                      onChange={(e) => field.onChange(maskCPF(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FieldGroup>

          <div className="border-t border-border" />

          <FieldGroup legend="Contato comercial">
            <FormField
              control={form.control}
              name="commercial_contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone ou e-mail</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Telefone ou e-mail"
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormDescription>
                    Canal para o time da Prestway falar sobre o cadastro da empresa.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FieldGroup>
        </div>
      )}
    </div>
  );
}
