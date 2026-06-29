import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth";
import { maskCPF } from "@/lib/masks";
import { saveCheckoutCpf } from "../../api/checkout.api";
import {
  cpfStepSchema,
  type CpfStepFormData,
} from "../../types/cpfStep.validation";

export type CpfStepProps = {
  defaultCpf?: string;
  onComplete: (cpf: string) => void;
  onBack?: () => void;
};

export function CpfStep({ defaultCpf = "", onComplete, onBack }: CpfStepProps) {
  const { user } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<CpfStepFormData>({
    resolver: zodResolver(cpfStepSchema),
    defaultValues: { cpf: defaultCpf },
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!user?.id) {
      setSubmitError("Sessão expirada. Faça login novamente.");
      return;
    }

    setSubmitError(null);
    setIsSaving(true);

    try {
      const result = await saveCheckoutCpf(user.id, values.cpf);
      if (result.error || !result.cpf) {
        setSubmitError(result.error ?? "Não foi possível salvar o CPF.");
        return;
      }

      onComplete(result.cpf);
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <Form {...form}>
      <form
        data-testid="checkout-step-cpf"
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Informe seu CPF</h2>
          <p className="text-sm text-muted-foreground">
            Precisamos do seu CPF para concluir o pagamento com segurança, conforme exigido
            pelo parceiro de pagamentos.
          </p>
        </div>

        <FormField
          control={form.control}
          name="cpf"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="checkout-cpf">CPF</FormLabel>
              <FormControl>
                <Input
                  id="checkout-cpf"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  value={field.value}
                  onChange={(event) => field.onChange(maskCPF(event.target.value))}
                  onBlur={field.onBlur}
                  disabled={isSaving}
                />
              </FormControl>
              <FormDescription>
                Seus dados são usados apenas para validação de identidade e proteção contra fraudes.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {submitError ? (
          <p className="text-sm text-destructive" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack} disabled={isSaving}>
              Voltar
            </Button>
          ) : null}
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Salvando..." : "Continuar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
