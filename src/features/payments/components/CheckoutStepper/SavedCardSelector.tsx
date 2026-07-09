import { useEffect, useState, type MutableRefObject } from "react";
import { CreditCard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CardForm, CARD_FORM_ID } from "./CardForm";
import { useSavedPaymentTokens } from "../../hooks/useSavedPaymentTokens";
import type { SavedCardSelection } from "../../types/paymentToken.types";
import type { TokenizeCardSuccess } from "../../api/cards.api";
import {
  formatCardExpiry,
  formatMaskedCardLabel,
  getCardBrandLabel,
} from "../../utils/cardPresentation";

export type SavedCardSelectorMode = "list" | "form";

export type SavedCardSelectorProps = {
  providerServiceId: string;
  savedCpf?: string | null;
  phone?: string;
  onSelect: (selection: SavedCardSelection) => void;
  /** Leave-step back (e.g. close dialog / previous checkout step). */
  onBack?: () => void;
  formId?: string;
  onModeChange?: (mode: SavedCardSelectorMode) => void;
  onCanContinueChange?: (canContinue: boolean) => void;
  onCanGoBackChange?: (canGoBack: boolean) => void;
  onPendingChange?: (isPending: boolean) => void;
  /** Parent Continuar — selects the highlighted saved card (null while on CardForm). */
  continueRef?: MutableRefObject<(() => void) | null>;
  /** Parent Voltar — returns to list when adding a card, otherwise onBack. */
  backRef?: MutableRefObject<(() => void) | null>;
};

export function SavedCardSelector({
  providerServiceId,
  savedCpf,
  phone,
  onSelect,
  onBack,
  formId = CARD_FORM_ID,
  onModeChange,
  onCanContinueChange,
  onCanGoBackChange,
  onPendingChange,
  continueRef,
  backRef,
}: SavedCardSelectorProps) {
  const tokensQuery = useSavedPaymentTokens();
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string>("");

  const tokens = tokensQuery.data ?? [];
  const hasSavedCards = tokens.length > 0;
  const showingForm = showNewCardForm || !hasSavedCards;
  const mode: SavedCardSelectorMode = showingForm ? "form" : "list";

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    if (showingForm) {
      onCanContinueChange?.(true);
      return;
    }
    onCanContinueChange?.(Boolean(selectedTokenId));
  }, [showingForm, selectedTokenId, onCanContinueChange]);

  useEffect(() => {
    onCanGoBackChange?.((showingForm && hasSavedCards) || Boolean(onBack));
  }, [showingForm, hasSavedCards, onBack, onCanGoBackChange]);

  useEffect(() => {
    if (showingForm) {
      return;
    }
    onPendingChange?.(false);
  }, [showingForm, onPendingChange]);

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
    continueRef.current = showingForm ? null : handleContinueWithSelectedCard;
  }

  if (backRef) {
    backRef.current =
      showingForm && hasSavedCards
        ? () => setShowNewCardForm(false)
        : (onBack ?? null);
  }

  const handleNewCardSuccess = (result: TokenizeCardSuccess) => {
    onSelect({
      paymentTokenId: result.paymentTokenId,
      cardBrand: result.cardBrand,
      cardNumberMasked: result.cardNumberMasked,
    });
  };

  if (showingForm) {
    return (
      <CardForm
        providerServiceId={providerServiceId}
        tokenizeContext="checkout"
        savedCpf={savedCpf}
        phone={phone}
        onSuccess={handleNewCardSuccess}
        onBack={hasSavedCards ? () => setShowNewCardForm(false) : onBack}
        hideActions
        formId={formId}
        onPendingChange={onPendingChange}
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

      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => setShowNewCardForm(true)}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Adicionar novo cartão
      </Button>
    </div>
  );
}
