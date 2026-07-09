import { useEffect, useState, type MutableRefObject } from "react";
import { CreditCard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useSavedPaymentTokens } from "../../hooks/useSavedPaymentTokens";
import type { SavedCardSelection } from "../../types/paymentToken.types";
import type { TokenizeCardSuccess } from "../../api/cards.api";
import {
  formatCardExpiry,
  formatMaskedCardLabel,
  getCardBrandLabel,
} from "../../utils/cardPresentation";
import { AddCardSheetDialog } from "../AddCardSheetDialog";

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
    return <p className="text-sm text-muted-foreground">Carregando cartões…</p>;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Escolha um cartão</h2>
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
            className="space-y-3"
          >
            {tokens.map((token) => (
              <Label
                key={token.id}
                htmlFor={`saved-card-${token.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4"
              >
                <RadioGroupItem id={`saved-card-${token.id}`} value={token.id} />
                <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {getCardBrandLabel(token.card_brand)} ·{" "}
                    {formatMaskedCardLabel(token.card_number_masked)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Validade {formatCardExpiry(token.expiry_month, token.expiry_year)}
                  </p>
                </div>
              </Label>
            ))}
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

/** @deprecated Mode is no longer used; card form opens in AddCardSheetDialog. */
export type SavedCardSelectorMode = "list" | "form";
