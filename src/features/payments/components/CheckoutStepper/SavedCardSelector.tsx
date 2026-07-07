import { useState } from "react";
import { CreditCard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CardForm } from "./CardForm";
import { useSavedPaymentTokens } from "../../hooks/useSavedPaymentTokens";
import type { SavedCardSelection } from "../../types/paymentToken.types";
import type { TokenizeCardSuccess } from "../../api/cards.api";
import {
  formatCardExpiry,
  formatMaskedCardLabel,
  getCardBrandLabel,
} from "../../utils/cardPresentation";

export type SavedCardSelectorProps = {
  providerServiceId: string;
  savedCpf?: string | null;
  phone?: string;
  onSelect: (selection: SavedCardSelection) => void;
  onBack?: () => void;
};

export function SavedCardSelector({
  providerServiceId,
  savedCpf,
  phone,
  onSelect,
  onBack,
}: SavedCardSelectorProps) {
  const tokensQuery = useSavedPaymentTokens();
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string>("");

  const tokens = tokensQuery.data ?? [];
  const hasSavedCards = tokens.length > 0;

  const handleNewCardSuccess = (result: TokenizeCardSuccess) => {
    onSelect({
      paymentTokenId: result.paymentTokenId,
      cardBrand: result.cardBrand,
    });
  };

  if (showNewCardForm || !hasSavedCards) {
    return (
      <CardForm
        providerServiceId={providerServiceId}
        tokenizeContext="checkout"
        savedCpf={savedCpf}
        phone={phone}
        onSuccess={handleNewCardSuccess}
        onBack={
          hasSavedCards
            ? () => setShowNewCardForm(false)
            : onBack
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Escolha um cartão</h2>
        <p className="text-sm text-muted-foreground">
          Selecione um cartão salvo ou adicione um novo para continuar.
        </p>
      </div>

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
                {getCardBrandLabel(token.card_brand)} · {formatMaskedCardLabel(token.card_number_masked)}
              </p>
              <p className="text-xs text-muted-foreground">
                Validade {formatCardExpiry(token.expiry_month, token.expiry_year)}
              </p>
            </div>
          </Label>
        ))}
      </RadioGroup>

      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => setShowNewCardForm(true)}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Adicionar novo cartão
      </Button>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack}>
            Voltar
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={!selectedTokenId}
          onClick={() => {
            const token = tokens.find((item) => item.id === selectedTokenId);
            if (!token) {
              return;
            }

            onSelect({
              paymentTokenId: token.id,
              cardBrand: token.card_brand,
            });
          }}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
