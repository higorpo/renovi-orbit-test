import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { DPO_EMAIL } from "../constants";
import { SettingsCardHeader } from "./SettingsCardHeader";

export function DangerZoneSection() {
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  return (
    <>
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir minha conta</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Para solicitar a exclusão da sua conta e dos seus dados pessoais, envie
                  um e-mail para o nosso encarregado de dados (DPO):
                </p>
                <p className="mt-3 font-semibold text-ink">
                  <a href={`mailto:${DPO_EMAIL}`} className="underline">
                    {DPO_EMAIL}
                  </a>
                </p>
                <p className="mt-3 text-sm">
                  Informe no e-mail que deseja solicitar a exclusão da sua conta conforme
                  a LGPD. Retornaremos em até 15 dias úteis.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDeleteAlert(false)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="rounded-2xl border-destructive/30 bg-destructive/5 shadow-sm">
        <CardHeader className="pb-3 sm:pb-3">
          <SettingsCardHeader
            title="Zona de perigo"
            icon={AlertTriangle}
            tone="danger"
            description="Ações irreversíveis relacionadas à sua conta"
          />
        </CardHeader>
        <CardContent className="space-y-4 pt-0 sm:pt-0">
          <p className="text-sm leading-relaxed text-body">
            Essa ação é irreversível. Seus dados serão removidos conforme as regras
            aplicáveis da LGPD e os requisitos legais de retenção.
          </p>
          <Button
            variant="destructive"
            className="rounded-full"
            onClick={() => setShowDeleteAlert(true)}
            aria-label="Excluir minha conta"
          >
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
