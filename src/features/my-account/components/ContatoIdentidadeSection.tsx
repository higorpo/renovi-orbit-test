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
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import { Phone } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { AccountFormData } from "../schemas/accountForm.validation";
import { maskPhone, maskCPF } from "@/lib/masks";

export interface ContatoIdentidadeSectionProps {
  form: UseFormReturn<AccountFormData>;
}

export function ContatoIdentidadeSection({ form }: ContatoIdentidadeSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-0">
        <SectionTitleWithIcon
          title="Contato e identidade"
          icon={Phone}
          iconGradient="from-emerald-500 to-teal-500"
          size="compact"
          className="!mb-0"
        />
      </CardHeader>
      <CardContent className="!pt-4 space-y-4">
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
