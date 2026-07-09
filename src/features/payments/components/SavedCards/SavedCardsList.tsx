import { useState } from "react";
import { CreditCard, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CardForm } from "../CheckoutStepper/CardForm";
import { useSavedCards } from "../../hooks/useSavedCards";
import { useClientCpfForPayment } from "../../hooks/useClientCpfForPayment";
import { useAuth } from "@/features/auth";
import type { TokenizeCardSuccess } from "../../api/cards.api";
import {
  formatCardExpiry,
  formatMaskedCardLabel,
  getCardBrandLabel,
} from "../../utils/cardPresentation";
import { mapPaymentErrorToUserMessage } from "../../utils/mapPaymentUserMessage";

export type SavedCardsListProps = {
  phone?: string;
  providerServiceId?: string;
  tokenizeContext?: "checkout" | "profile";
};

export function SavedCardsList({
  phone,
  providerServiceId,
  tokenizeContext = providerServiceId ? "checkout" : "profile",
}: SavedCardsListProps) {
  const { cards, isLoading, revokeCard, isRevoking, revokingTokenId, refetch } = useSavedCards();
  const { profile } = useAuth();
  const { cpf: savedCpf } = useClientCpfForPayment();
  const resolvedPhone = phone ?? profile?.phone ?? undefined;
  const [showAddForm, setShowAddForm] = useState(false);
  const [tokenToRemove, setTokenToRemove] = useState<string | null>(null);
  const [blockedWarning, setBlockedWarning] = useState<{
    tokenId: string;
    scheduleCount: number;
  } | null>(null);

  const handleAddSuccess = (_result: TokenizeCardSuccess) => {
    setShowAddForm(false);
    void refetch();
    toast.success("Cartão adicionado com sucesso.");
  };

  const handleConfirmRemove = async () => {
    if (!tokenToRemove) {
      return;
    }

    try {
      const outcome = await revokeCard(tokenToRemove);

      if (outcome.outcome === "revoked") {
        toast.success("Cartão removido.");
        setTokenToRemove(null);
        return;
      }

      if (outcome.outcome === "blocked") {
        setTokenToRemove(null);
        setBlockedWarning({
          tokenId: tokenToRemove,
          scheduleCount: outcome.schedules.length,
        });
        return;
      }

      toast.error("Não foi possível remover este cartão.");
      setTokenToRemove(null);
    } catch (error) {
      toast.error(
        mapPaymentErrorToUserMessage(error, {
          fallback: "Não foi possível remover este cartão. Tente novamente.",
        }),
      );
      setTokenToRemove(null);
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-xl border border-border p-6" aria-label="Cartões salvos">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando cartões…
        </div>
      </section>
    );
  }

  if (showAddForm) {
    return (
      <section className="rounded-xl border border-border p-6 space-y-4" aria-label="Adicionar cartão">
        <CardForm
          providerServiceId={providerServiceId}
          tokenizeContext={tokenizeContext}
          savedCpf={savedCpf}
          phone={resolvedPhone}
          submitLabel="Salvar cartão"
          onSuccess={handleAddSuccess}
          onBack={cards.length > 0 ? () => setShowAddForm(false) : undefined}
        />
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border p-6 space-y-4" aria-label="Cartões salvos">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Formas de pagamento</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie os cartões salvos para pagamentos futuros.
        </p>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cartão salvo ainda.</p>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex items-center gap-3 rounded-xl border border-border p-4"
            >
              <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">
                  {getCardBrandLabel(card.card_brand)} · {formatMaskedCardLabel(card.card_number_masked)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Validade {formatCardExpiry(card.expiry_month, card.expiry_year)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover cartão ${formatMaskedCardLabel(card.card_number_masked)}`}
                disabled={isRevoking && revokingTokenId === card.id}
                onClick={() => setTokenToRemove(card.id)}
              >
                {isRevoking && revokingTokenId === card.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => setShowAddForm(true)}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Adicionar Cartão
      </Button>

      <AlertDialog open={tokenToRemove !== null} onOpenChange={(open) => !open && setTokenToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              Este cartão deixará de aparecer na sua conta. Você poderá adicioná-lo novamente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmRemove()} disabled={isRevoking}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={blockedWarning !== null}
        onOpenChange={(open) => !open && setBlockedWarning(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não é possível remover este cartão</AlertDialogTitle>
            <AlertDialogDescription>
              {blockedWarning
                ? `Este cartão está vinculado a ${blockedWarning.scheduleCount} pagamento(s) pendente(s). Atribua outro cartão ao serviço antes de removê-lo.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBlockedWarning(null)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
