import { useEffect, useState, type MutableRefObject } from "react";
import { CreditCard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSavedPaymentTokens } from "../../hooks/useSavedPaymentTokens";
import type { SavedCardSelection } from "../../types/paymentToken.types";
import type { TokenizeCardSuccess } from "../../api/cards.api";
import {
  formatCardExpiry,
  formatMaskedCardLabel,
  getCardBrandLabel,
} from "../../utils/cardPresentation";
import { AddCardSheetDialog } from "../AddCardSheetDialog";
import { SavedCardSelectorSkeleton } from "./SavedCardSelectorSkeleton";

export type SavedCardSelectorProps = {
  providerServiceId: string;
  savedCpf?: string | null;
  phone?: string;
  onSelect: (selection: SavedCardSelection) => void;
  onCanContinueChange?: (canContinue: boolean) => void;
  /** Parent Continuar — selects the highlighted saved card. */
  continueRef?: MutableRefObject<(() => void) | null>;
};

export function SavedCardSelector({
  providerServiceId,
  savedCpf,
  phone,
  onSelect,
  onCanContinueChange,
  continueRef,
}: SavedCardSelectorProps) {
  const tokensQuery = useSavedPaymentTokens();
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string>("");

  const tokens = tokensQuery.data ?? [];
  const hasSavedCards = tokens.length > 0;
  const isLoading = tokensQuery.isLoading;

  useEffect(() => {
    onCanContinueChange?.(Boolean(selectedTokenId));
  }, [selectedTokenId, onCanContinueChange]);

  const handleContinueWithSelectedCard = () => {
    const token = tokens.find((item) => item.id === selectedTokenId);
    if (!token) {
      return;
    }

    onSelect({
      paymentTokenId: token.id,
      cardBrand: token.card_brand,
      cardNumberMasked: token.card_number_masked,
      expiryMonth: token.expiry_month,
      expiryYear: token.expiry_year,
    });
  };

  if (continueRef) {
    continueRef.current = handleContinueWithSelectedCard;
  }

  const handleNewCardSuccess = (result: TokenizeCardSuccess) => {
    onSelect({
      paymentTokenId: result.paymentTokenId,
      cardBrand: result.cardBrand,
      cardNumberMasked: result.cardNumberMasked,
    });
  };

  if (isLoading) {
    return <SavedCardSelectorSkeleton />;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {hasSavedCards
              ? "Selecione um cartão salvo ou adicione um novo para continuar."
              : "Adicione um cartão de crédito para continuar."}
          </p>
        </div>

        {hasSavedCards ? (
          <RadioGroup
            value={selectedTokenId}
            onValueChange={setSelectedTokenId}
            className="gap-3"
          >
            {tokens.map((token) => {
              const isSelected = selectedTokenId === token.id;
              const brandLabel = getCardBrandLabel(token.card_brand);
              const maskedLabel = formatMaskedCardLabel(token.card_number_masked);

              return (
                <Label
                  key={token.id}
                  htmlFor={`saved-card-${token.id}`}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-4",
                    "transition-[transform,border-color,background-color,box-shadow] duration-150 ease-out",
                    "active:scale-[0.97]",
                    "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                    "[@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/40",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      "transition-colors duration-150 ease-out",
                      isSelected
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    <CreditCard className="h-5 w-5" />
                  </span>

                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                          isSelected
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {brandLabel}
                      </span>
                      <span className="text-base font-semibold tracking-wide text-foreground">
                        {maskedLabel}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Validade {formatCardExpiry(token.expiry_month, token.expiry_year)}
                    </span>
                  </span>

                  <RadioGroupItem
                    id={`saved-card-${token.id}`}
                    value={token.id}
                    className="sr-only"
                    aria-label={`${brandLabel} ${maskedLabel}`}
                  />
                </Label>
              );
            })}
          </RadioGroup>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setAddCardOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar novo cartão
        </Button>
      </div>

      <AddCardSheetDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        providerServiceId={providerServiceId}
        tokenizeContext="checkout"
        savedCpf={savedCpf}
        phone={phone}
        onSuccess={handleNewCardSuccess}
      />
    </>
  );
}
