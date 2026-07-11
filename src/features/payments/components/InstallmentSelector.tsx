import { useEffect, useState, type MutableRefObject } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ErrorState } from "@/components/ui/error-state";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import {
  useInstallmentOptions,
  useInstallmentSignatureRecovery,
} from "../hooks/useInstallmentOptions";
import type { InstallmentSelection } from "../types/paymentToken.types";
import { InstallmentSelectorSkeleton } from "./InstallmentSelectorSkeleton";

export type InstallmentSelectorProps = {
  proposalId: string;
  serviceId: string;
  cardBrand: string;
  paymentTokenId: string;
  onSelect: (selection: InstallmentSelection) => void;
  onCanContinueChange?: (canContinue: boolean) => void;
  /** Parent Continuar — confirms the selected installment. */
  continueRef?: MutableRefObject<(() => void) | null>;
};

export function InstallmentSelector({
  proposalId,
  serviceId,
  cardBrand,
  paymentTokenId,
  onSelect,
  onCanContinueChange,
  continueRef,
}: InstallmentSelectorProps) {
  const [selectedInstallment, setSelectedInstallment] = useState<string>("");
  const installmentQuery = useInstallmentOptions({
    proposalId,
    serviceId,
    cardBrand,
    enabled: Boolean(proposalId && serviceId && cardBrand),
  });

  const { handleSignatureExpired } = useInstallmentSignatureRecovery(
    paymentTokenId,
    installmentQuery.refetch,
  );

  const options = installmentQuery.data?.installment_options ?? [];

  const handleContinue = () => {
    const installmentNumber = Number.parseInt(selectedInstallment, 10);
    const selectedOption = options.find(
      (option) => option.installment_number === installmentNumber,
    );
    const installmentData = installmentQuery.data;

    if (!selectedOption || !installmentData) {
      return;
    }

    const hmac = installmentData.installment_selection_hmac;
    const hmacPayload = installmentData.installment_hmac_payload;

    if (!hmac || !hmacPayload) {
      return;
    }

    onSelect({
      installmentNumber: selectedOption.installment_number,
      installmentSelectionHmac: hmac,
      installmentHmacPayload: hmacPayload,
      installmentAmount: selectedOption.installment_amount,
      totalWithFees: selectedOption.total_with_fees,
      installmentOptions: options,
      computedAt: installmentData.computed_at ?? new Date().toISOString(),
      expiresAt: installmentData.expires_at ?? new Date().toISOString(),
    });
  };

  useEffect(() => {
    const canContinue =
      !installmentQuery.isLoading &&
      !installmentQuery.isError &&
      Boolean(selectedInstallment);
    onCanContinueChange?.(canContinue);
  }, [
    installmentQuery.isLoading,
    installmentQuery.isError,
    selectedInstallment,
    onCanContinueChange,
  ]);

  if (continueRef) {
    continueRef.current = handleContinue;
  }

  if (installmentQuery.isLoading) {
    return <InstallmentSelectorSkeleton />;
  }

  if (installmentQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar as parcelas"
        description={
          installmentQuery.error instanceof Error
            ? installmentQuery.error.message
            : "Verifique sua conexão e tente novamente. Se o problema persistir, entre em contato com o suporte."
        }
        onRetry={() => {
          void installmentQuery.refetch();
        }}
        className="py-8"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-foreground">Escolha o parcelamento</h2>
        <p className="text-sm text-muted-foreground">
          Os valores abaixo já incluem taxas de processamento do cartão.
        </p>
      </div>

      <RadioGroup
        value={selectedInstallment}
        onValueChange={setSelectedInstallment}
        className="gap-3"
      >
        {options.map((option) => {
          const value = String(option.installment_number);
          const isSelected = selectedInstallment === value;
          const installmentLabel = `${option.installment_number}x de ${formatCurrency(option.installment_amount)}`;

          return (
            <Label
              key={option.installment_number}
              htmlFor={`installment-${option.installment_number}`}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-4",
                "transition-[transform,border-color,background-color,box-shadow] duration-150 ease-out",
                "active:scale-[0.97]",
                "[@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/40",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular-nums",
                  "transition-colors duration-150 ease-out",
                  isSelected
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {option.installment_number}x
              </span>

              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-base font-semibold tracking-tight text-foreground">
                  {formatCurrency(option.installment_amount)}
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    / parcela
                  </span>
                </span>
                <span className="block text-xs text-muted-foreground">
                  Total com taxas: {formatCurrency(option.total_with_fees)}
                </span>
              </span>

              <RadioGroupItem
                id={`installment-${option.installment_number}`}
                value={value}
                className="sr-only"
                aria-label={installmentLabel}
              />
            </Label>
          );
        })}
      </RadioGroup>

      <p className="text-xs text-muted-foreground pb-4">
        As taxas variam conforme a bandeira e a quantidade de parcelas. O valor final será
        confirmado antes da cobrança.
      </p>

      <button
        type="button"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        data-testid="installment-signature-recovery-trigger"
        onClick={() => {
          void handleSignatureExpired();
        }}
      />
    </div>
  );
}
