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
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import { useAuth } from "@/features/auth";

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

      <Card>
        <CardHeader className="pb-3 sm:pb-0">
          <SectionTitleWithIcon
            title="Sessão"
            icon={LogOut}
            iconGradient="from-slate-500 to-slate-600"
            size="compact"
            className="!mb-0"
          />
        </CardHeader>
        <CardContent className="!pt-3">
          <p className="text-sm text-muted-foreground mb-4">
            Encerra sua sessão atual neste dispositivo. Você precisará fazer login novamente para acessar a plataforma.
          </p>
          <Button
            variant="outline"
            onClick={() => setShowConfirm(true)}
            className="gap-2"
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
