import { useEffect, useState, type MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  useInstallmentOptions,
  useInstallmentSignatureRecovery,
} from "../hooks/useInstallmentOptions";
import type { InstallmentSelection } from "../types/paymentToken.types";

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
    return <p className="text-sm text-muted-foreground">Calculando parcelas...</p>;
  }

  if (installmentQuery.isError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">
          {installmentQuery.error instanceof Error
            ? installmentQuery.error.message
            : "Não foi possível carregar as parcelas."}
        </p>
        <Button type="button" variant="outline" onClick={() => installmentQuery.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Escolha o parcelamento</h2>
        <p className="text-sm text-muted-foreground">
          Os valores abaixo já incluem taxas de processamento do cartão.
        </p>
      </div>

      <RadioGroup
        value={selectedInstallment}
        onValueChange={setSelectedInstallment}
        className="space-y-3"
      >
        {options.map((option) => (
          <Label
            key={option.installment_number}
            htmlFor={`installment-${option.installment_number}`}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4"
          >
            <RadioGroupItem
              id={`installment-${option.installment_number}`}
              value={String(option.installment_number)}
              className="mt-1"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {option.installment_number}x de {formatCurrency(option.installment_amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                Total com taxas: {formatCurrency(option.total_with_fees)}
              </p>
            </div>
          </Label>
        ))}
      </RadioGroup>

      <p className="text-xs text-muted-foreground">
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

export { useInstallmentSignatureRecovery };
