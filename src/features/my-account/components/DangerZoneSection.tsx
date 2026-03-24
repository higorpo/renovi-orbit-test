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
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import { AlertTriangle } from "lucide-react";
import { DPO_EMAIL } from "../constants";

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
                  Para solicitar a exclusão da sua conta e dos seus dados pessoais,
                  envie um e-mail para o nosso encarregado de dados (DPO):
                </p>
                <p className="mt-3 font-semibold text-foreground">
                  <a href={`mailto:${DPO_EMAIL}`} className="underline">
                    {DPO_EMAIL}
                  </a>
                </p>
                <p className="mt-3 text-sm">
                  Informe no e-mail que deseja solicitar a exclusão da sua conta
                  conforme a LGPD. Retornaremos em até 15 dias úteis.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDeleteAlert(false)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-3 sm:pb-0">
          <SectionTitleWithIcon
            title="Zona de perigo"
            icon={AlertTriangle}
            iconGradient="from-destructive to-destructive/80"
            size="compact"
            className="!mb-0"
          />
        </CardHeader>
        <CardContent className="!pt-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Essa ação é irreversível. Seus dados serão removidos conforme as regras
            aplicáveis da LGPD e os requisitos legais de retenção.
          </p>
          <Button
            variant="destructive"
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
