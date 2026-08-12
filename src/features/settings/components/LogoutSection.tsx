import { useState } from "react";
import { LogOut } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { useAuth } from "@/features/auth";
import { SettingsCardHeader } from "./SettingsCardHeader";

export function LogoutSection() {
  const { signOut } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    await signOut();
    setIsLoading(false);
  };

  return (
    <>
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da plataforma</AlertDialogTitle>
            <AlertDialogDescription>
              Você será desconectado da sua conta. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? "Saindo…" : "Sair"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-2">
          <SettingsCardHeader
            title="Sessão"
            icon={LogOut}
            description="Encerre o acesso neste dispositivo"
          />
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <p className="text-sm leading-relaxed text-body">
            Encerra sua sessão atual neste dispositivo. Você precisará fazer login
            novamente para acessar a plataforma.
          </p>
          <Button
            variant="outline"
            onClick={() => setShowConfirm(true)}
            className="gap-2 rounded-full"
            aria-label="Sair da plataforma"
          >
            <LogOut className="h-4 w-4" />
            Sair da plataforma
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
