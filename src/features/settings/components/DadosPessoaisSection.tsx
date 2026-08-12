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
import { User } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { AccountFormData } from "../types/accountForm.validation";
import { SettingsCardHeader } from "./SettingsCardHeader";

export interface DadosPessoaisSectionProps {
  form: UseFormReturn<AccountFormData>;
  email: string;
}

export function DadosPessoaisSection({ form, email }: DadosPessoaisSectionProps) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-2">
        <SettingsCardHeader
          title="Dados pessoais"
          icon={User}
          description="Como você aparece na Prestway"
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="account-full_name">Nome completo</FormLabel>
              <FormControl>
                <Input
                  id="account-full_name"
                  type="text"
                  autoComplete="name"
                  placeholder="Nome e sobrenome"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <FormLabel htmlFor="account-email">E-mail</FormLabel>
          <Input
            id="account-email"
            type="email"
            value={email}
            readOnly
            disabled
            aria-readonly="true"
            className="bg-canvas-soft"
          />
          <FormDescription>
            Seu e-mail não pode ser alterado por aqui. Caso precise alterar, entre em
            contato com o suporte.
          </FormDescription>
        </div>
      </CardContent>
    </Card>
  );
}
