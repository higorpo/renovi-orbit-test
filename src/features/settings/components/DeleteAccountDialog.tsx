import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRMATION_TEXT = "EXCLUIR";

export interface DeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export function DeleteAccountDialog({
  open,
  onClose,
  onConfirm,
}: DeleteAccountDialogProps) {
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim().toUpperCase() === CONFIRMATION_TEXT;

  const handleClose = () => {
    setTyped("");
    onClose();
  };

  const handleConfirm = () => {
    if (!confirmed || !onConfirm) return;
    onConfirm();
    setTyped("");
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir minha conta</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Essa ação é irreversível. Todos os seus dados serão removidos de
                acordo com a LGPD.
              </p>
              <p>
                Para confirmar, digite <strong>{CONFIRMATION_TEXT}</strong> abaixo:
              </p>
              <Label htmlFor="delete-account-confirm" className="sr-only">
                Digite EXCLUIR para confirmar
              </Label>
              <Input
                id="delete-account-confirm"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={CONFIRMATION_TEXT}
                className="font-mono"
                aria-describedby="delete-account-desc"
              />
              <p id="delete-account-desc" className="text-xs text-muted-foreground">
                Digite exatamente &quot;EXCLUIR&quot; para habilitar o botão.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={!confirmed}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            Excluir minha conta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
