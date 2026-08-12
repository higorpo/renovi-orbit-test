import { useEffect, useState } from "react";
import { CreditCard, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { AddCardSheetDialog } from "../AddCardSheetDialog";
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

function SavedCardsListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando cartões">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>
      <Skeleton className="h-[4.75rem] w-full rounded-2xl" />
      <Skeleton className="h-[4.75rem] w-full rounded-2xl" />
    </div>
  );
}

export function SavedCardsList({
  phone,
  providerServiceId,
  tokenizeContext = providerServiceId ? "checkout" : "profile",
}: SavedCardsListProps) {
  const { cards, isLoading, revokeCard, isRevoking, revokingTokenId, refetch } = useSavedCards();
  const { profile, refreshProfile } = useAuth();
  const { cpf: savedCpf } = useClientCpfForPayment();
  const resolvedPhone = phone ?? profile?.phone ?? undefined;

  useEffect(() => {
    if (resolvedPhone?.replace(/\D/g, "").trim()) return;
    void refreshProfile();
  }, [resolvedPhone, refreshProfile]);

  const [addCardOpen, setAddCardOpen] = useState(false);
  const [tokenToRemove, setTokenToRemove] = useState<string | null>(null);
  const [blockedWarning, setBlockedWarning] = useState<{
    tokenId: string;
    scheduleCount: number;
  } | null>(null);

  const handleAddSuccess = (_result: TokenizeCardSuccess) => {
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
    return <SavedCardsListSkeleton />;
  }

  return (
    <>
      <div className="space-y-4" aria-label="Cartões salvos">
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption text-muted-foreground">
            {cards.length === 0
              ? "Nenhum cadastrado"
              : cards.length === 1
                ? "1 cartão"
                : `${cards.length} cartões`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setAddCardOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Adicionar cartão
          </Button>
        </div>

        {cards.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-canvas-soft px-6 py-12 text-center">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"
              aria-hidden
            >
              <CreditCard className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <p className="font-display text-base font-semibold tracking-tight text-ink">
              Nenhum cartão salvo ainda
            </p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-body">
              Adicione um cartão para pagar serviços com mais agilidade.
            </p>
          </div>
        ) : (
          <ul className="m-0 list-none space-y-3 p-0">
            {cards.map((card) => (
              <li key={card.id}>
                <article className="rounded-2xl border border-border bg-canvas p-4 shadow-sm sm:p-5">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
                      aria-hidden
                    >
                      <CreditCard className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[15px] font-semibold tracking-tight text-ink">
                        {getCardBrandLabel(card.card_brand)} ·{" "}
                        {formatMaskedCardLabel(card.card_number_masked)}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Validade {formatCardExpiry(card.expiry_month, card.expiry_year)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-full text-body hover:bg-destructive/10 hover:text-destructive"
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
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddCardSheetDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        providerServiceId={providerServiceId}
        tokenizeContext={tokenizeContext}
        desktopPresentation="sheet"
        savedCpf={savedCpf}
        phone={resolvedPhone}
        onSuccess={handleAddSuccess}
      />

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
    </>
  );
}
