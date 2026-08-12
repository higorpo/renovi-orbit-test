import type { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SettingsCardHeader } from "./SettingsCardHeader";
import { FileText } from "lucide-react";
import { maskCPF, maskCNPJ } from "@/lib/masks";
import type { ProviderAccountFormData } from "../types/providerAccountForm.validation";
import type { EntityType } from "./EntityTypeSection";

export interface LegalIdentitySectionProps {
  form: UseFormReturn<ProviderAccountFormData>;
  entityType: EntityType;
  disabled?: boolean;
}

export function LegalIdentitySection({
  form,
  entityType,
  disabled,
}: LegalIdentitySectionProps) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3 sm:pb-3">
        <SettingsCardHeader
          title="Dados legais / identidade"
          icon={FileText}
          description="Documentos usados para verificação e fiscal"
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-0 sm:pt-0">
        {entityType === "pf" ? (
          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="000.000.000-00"
                    disabled={disabled}
                    onChange={(e) => field.onChange(maskCPF(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <>
            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="XX.XXX.XXX/XXXX-XX"
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
                    <Input {...field} disabled={disabled} />
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
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legal_representative_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Representante legal</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={disabled} placeholder="Nome completo" />
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
                  <FormLabel>CPF do representante legal</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="000.000.000-00"
                      disabled={disabled}
                      onChange={(e) => field.onChange(maskCPF(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="commercial_contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contato comercial</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Telefone ou e-mail para contato comercial"
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
