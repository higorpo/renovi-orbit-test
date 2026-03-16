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
import type { ClientAddressWithRelations } from "../../types/addresses.types";

export interface DeleteAddressDialogProps {
  open: boolean;
  address: ClientAddressWithRelations | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAddressDialog({
  open,
  address,
  onClose,
  onConfirm,
}: DeleteAddressDialogProps) {
  const line = address
    ? [address.street, address.number, address.neighborhood].filter(Boolean).join(", ")
    : "";

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir endereço?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O endereço {line && `"${line}"`} será removido da
            sua lista.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
              onClose();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
