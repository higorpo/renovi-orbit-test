import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { maskPhone } from "@/lib/masks";
import { saveCheckoutPhone } from "../../api/checkout.api";
import {
  phoneStepSchema,
  type PhoneStepFormData,
} from "../../types/phoneStep.validation";
import { PHONE_STEP_FORM_ID } from "../../constants/checkoutFormIds";

export type PhoneStepProps = {
  defaultPhone?: string;
  onComplete: (phone: string) => void;
  formId?: string;
};

export { PHONE_STEP_FORM_ID };

export function PhoneStep({
  defaultPhone = "",
  onComplete,
  formId = PHONE_STEP_FORM_ID,
}: PhoneStepProps) {
  const { user } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<PhoneStepFormData>({
    resolver: zodResolver(phoneStepSchema),
    defaultValues: { phone: defaultPhone },
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
      const result = await saveCheckoutPhone(user.id, values.phone);
      if (result.error || !result.phone) {
        setSubmitError(result.error ?? "Não foi possível salvar o telefone.");
        return;
      }

      onComplete(result.phone);
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <Form {...form}>
      <form
        id={formId}
        data-testid="checkout-step-phone"
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Informe seu telefone</h2>
          <p className="text-sm text-muted-foreground">
            Usamos seu telefone para contato sobre o pagamento e confirmações do serviço, e
            também para ajudar a prevenir fraudes.
          </p>
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="checkout-phone">Telefone / WhatsApp</FormLabel>
              <FormControl>
                <Input
                  id="checkout-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  value={field.value}
                  onChange={(event) => field.onChange(maskPhone(event.target.value))}
                  onBlur={field.onBlur}
                  disabled={isSaving}
                />
              </FormControl>
              <FormDescription>
                Informe um número com DDD para receber atualizações sobre o pagamento.
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
      </form>
    </Form>
  );
}
