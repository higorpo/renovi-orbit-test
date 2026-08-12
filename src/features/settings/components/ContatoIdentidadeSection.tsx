import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Phone } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { AccountFormData } from "../types/accountForm.validation";
import { maskPhone, maskCPF } from "@/lib/masks";
import { SettingsCardHeader } from "./SettingsCardHeader";

export interface ContatoIdentidadeSectionProps {
  form: UseFormReturn<AccountFormData>;
}

export function ContatoIdentidadeSection({ form }: ContatoIdentidadeSectionProps) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-2">
        <SettingsCardHeader
          title="Contato e identidade"
          icon={Phone}
          description="Telefone e documento para contato e verificação"
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="account-phone">Telefone / WhatsApp</FormLabel>
              <FormControl>
                <Input
                  id="account-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  value={field.value}
                  onChange={(e) => field.onChange(maskPhone(e.target.value))}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormDescription>
                Use um número de WhatsApp ou telefone para contato sobre seus serviços.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cpf"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="account-cpf">CPF</FormLabel>
              <FormControl>
                <Input
                  id="account-cpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={field.value}
                  onChange={(e) => field.onChange(maskCPF(e.target.value))}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormDescription>
                Seu CPF é usado apenas para validação de identidade e proteção da sua
                conta, em conformidade com a LGPD.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
