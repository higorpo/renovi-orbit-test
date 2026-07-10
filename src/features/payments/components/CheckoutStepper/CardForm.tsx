import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
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
import { maskCEP, maskCPF, unmask } from "@/lib/masks";
import {
  mapCardFormToTokenizeRequest,
  type TokenizeCardSuccess,
} from "../../api/cards.api";
import { useTokenizeCard } from "../../hooks/useTokenizeCard";
import {
  cardFormSchema,
  defaultCardFormValues,
  type CardFormData,
} from "../../types/cardForm.validation";
import { maskCardNumber } from "../../utils/card-validator";
import {
  CARDHOLDER_NAME_SOFT_WARNING,
  cardholderFirstNameMatchesAccount,
} from "../../utils/cardholderIdentity";
import { mapPaymentErrorToUserMessage } from "../../utils/mapPaymentUserMessage";
import { scrollToFirstCardFormError } from "../../utils/scrollToFirstCardFormError";
import { PaymentTrustDisclosure } from "../PaymentTrustDisclosure";

export const CARD_FORM_ID = "payment-card-form";

export type CardFormProps = {
  providerServiceId?: string;
  tokenizeContext?: "checkout" | "profile";
  savedCpf?: string | null;
  /** Account full name used for soft first-name check against the embossed name. */
  accountFullName?: string | null;
  phone?: string;
  onSuccess: (result: TokenizeCardSuccess) => void;
  onBack?: () => void;
  submitLabel?: string;
  /** Hide inline Continuar/Voltar so a parent DialogFooter can own them. */
  hideActions?: boolean;
  formId?: string;
  onPendingChange?: (isPending: boolean) => void;
};

export function CardForm({
  providerServiceId,
  tokenizeContext,
  savedCpf,
  accountFullName,
  phone,
  onSuccess,
  onBack,
  submitLabel,
  hideActions = false,
  formId = CARD_FORM_ID,
  onPendingChange,
}: CardFormProps) {
  const tokenizeCard = useTokenizeCard();

  const form = useForm<CardFormData>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: defaultCardFormValues(),
    mode: "onSubmit",
  });

  const watchedCardholderName = useWatch({
    control: form.control,
    name: "cardholderName",
  });
  const showNameSoftWarning =
    Boolean(watchedCardholderName?.trim()) &&
    !cardholderFirstNameMatchesAccount(watchedCardholderName, accountFullName);

  useEffect(() => {
    onPendingChange?.(tokenizeCard.isPending);
  }, [onPendingChange, tokenizeCard.isPending]);

  const handleSubmit = form.handleSubmit(
    async (values) => {
      if (!savedCpf?.trim()) {
        toast.error(
          tokenizeContext === "checkout"
            ? "Complete a etapa de CPF antes de continuar."
            : "Cadastre seu CPF na conta antes de adicionar um cartão.",
        );
        return;
      }

      if (!phone?.replace(/\D/g, "").trim()) {
        toast.error(
          tokenizeContext === "checkout"
            ? "Complete a etapa de telefone antes de continuar."
            : "Informe seu telefone para continuar.",
        );
        return;
      }

      try {
        const result = await tokenizeCard.mutateAsync(
          mapCardFormToTokenizeRequest(values, {
            providerServiceId,
            tokenizeContext,
            phone: unmask(phone),
          }),
        );

        form.reset(defaultCardFormValues());
        onSuccess(result);
      } catch (error) {
        toast.error(
          mapPaymentErrorToUserMessage(error, {
            fallback: "Não foi possível salvar o cartão. Verifique os dados e tente novamente.",
          }),
        );
      }
    },
    (errors) => {
      scrollToFirstCardFormError(errors);
    },
  );
  return (
    <Form {...form}>
      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        <PaymentTrustDisclosure />

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="cardNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="checkout-card-number">Número do cartão</FormLabel>
                <FormControl>
                  <Input
                    id="checkout-card-number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="0000 0000 0000 0000"
                    value={field.value}
                    onChange={(event) => field.onChange(maskCardNumber(event.target.value))}
                    onBlur={field.onBlur}
                    disabled={tokenizeCard.isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField
              control={form.control}
              name="expiryMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="checkout-expiry-month">Mês</FormLabel>
                  <FormControl>
                    <Input
                      id="checkout-expiry-month"
                      inputMode="numeric"
                      autoComplete="cc-exp-month"
                      placeholder="MM"
                      maxLength={2}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={tokenizeCard.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expiryYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="checkout-expiry-year">Ano</FormLabel>
                  <FormControl>
                    <Input
                      id="checkout-expiry-year"
                      inputMode="numeric"
                      autoComplete="cc-exp-year"
                      placeholder="AAAA"
                      maxLength={4}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={tokenizeCard.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cvv"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel htmlFor="checkout-cvv">CVV</FormLabel>
                  <FormControl>
                    <Input
                      id="checkout-cvv"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="123"
                      maxLength={4}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value.replace(/\D/g, ""))}
                      onBlur={field.onBlur}
                      disabled={tokenizeCard.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="cardholderName"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="checkout-cardholder-name">Nome no cartão</FormLabel>
                <FormControl>
                  <Input
                    id="checkout-cardholder-name"
                    autoComplete="cc-name"
                    placeholder="Como impresso no cartão"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={tokenizeCard.isPending}
                  />
                </FormControl>
                {showNameSoftWarning ? (
                  <FormDescription className="text-amber-700 dark:text-amber-400">
                    {CARDHOLDER_NAME_SOFT_WARNING}
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cardholderCpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="checkout-cardholder-cpf">CPF do titular do cartão</FormLabel>
                <FormControl>
                  <Input
                    id="checkout-cardholder-cpf"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000.000.000-00"
                    value={field.value}
                    onChange={(event) => field.onChange(maskCPF(event.target.value))}
                    onBlur={field.onBlur}
                    disabled={tokenizeCard.isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-medium">Endereço de cobrança</h3>

          <FormField
            control={form.control}
            name="street"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="checkout-billing-street">Logradouro</FormLabel>
                <FormControl>
                  <Input
                    id="checkout-billing-street"
                    autoComplete="address-line1"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={tokenizeCard.isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="checkout-billing-number">Número</FormLabel>
                  <FormControl>
                    <Input
                      id="checkout-billing-number"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={tokenizeCard.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additionalDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="checkout-billing-complement">Complemento</FormLabel>
                  <FormControl>
                    <Input
                      id="checkout-billing-complement"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={tokenizeCard.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="district"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="checkout-billing-district">Bairro</FormLabel>
                <FormControl>
                  <Input
                    id="checkout-billing-district"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={tokenizeCard.isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel htmlFor="checkout-billing-city">Cidade</FormLabel>
                  <FormControl>
                    <Input
                      id="checkout-billing-city"
                      autoComplete="address-level2"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={tokenizeCard.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="checkout-billing-state">UF</FormLabel>
                  <FormControl>
                    <Input
                      id="checkout-billing-state"
                      autoComplete="address-level1"
                      maxLength={2}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                      onBlur={field.onBlur}
                      disabled={tokenizeCard.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="zipCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="checkout-billing-zip">CEP</FormLabel>
                <FormControl>
                  <Input
                    id="checkout-billing-zip"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="00000-000"
                    value={field.value}
                    onChange={(event) => field.onChange(maskCEP(event.target.value))}
                    onBlur={field.onBlur}
                    disabled={tokenizeCard.isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {hideActions ? null : (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {onBack ? (
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                disabled={tokenizeCard.isPending}
              >
                Voltar
              </Button>
            ) : null}
            <Button type="submit" disabled={tokenizeCard.isPending}>
              {tokenizeCard.isPending
                ? "Salvando cartão..."
                : (submitLabel ?? "Continuar")}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}