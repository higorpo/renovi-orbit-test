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
import { Shield } from "lucide-react";
import { DPO_EMAIL } from "../constants";
import { SettingsCardHeader } from "./SettingsCardHeader";

export interface PrivacySectionProps {
  privacyPolicyUrl?: string | null;
}

export function PrivacySection({ privacyPolicyUrl }: PrivacySectionProps) {
  const [showExportAlert, setShowExportAlert] = useState(false);

  return (
    <>
      <AlertDialog open={showExportAlert} onOpenChange={setShowExportAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exportar meus dados</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Para solicitar a exportação dos seus dados pessoais, envie um e-mail para
                  o nosso encarregado de dados (DPO):
                </p>
                <p className="mt-3 font-semibold text-ink">
                  <a href={`mailto:${DPO_EMAIL}`} className="underline">
                    {DPO_EMAIL}
                  </a>
                </p>
                <p className="mt-3 text-sm">
                  Informe no e-mail que deseja solicitar a portabilidade dos seus dados
                  conforme a LGPD. Retornaremos em até 15 dias úteis.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowExportAlert(false)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-2">
          <SettingsCardHeader
            title="Privacidade e LGPD"
            icon={Shield}
            description="Seus direitos e como tratamos seus dados"
          />
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-body">
              Se você tiver dúvidas sobre como tratamos seus dados pessoais ou quiser
              exercer seus direitos previstos na LGPD, fale com o nosso encarregado de
              dados.
            </p>
            <Button variant="outline" className="rounded-full" asChild>
              <a href={`mailto:${DPO_EMAIL}`} aria-label="Falar com o DPO">
                Falar com o DPO
              </a>
            </Button>
          </div>

          <div className="space-y-3 border-t border-border pt-6">
            <p className="text-sm leading-relaxed text-body">
              Baixe uma cópia dos dados que a Prestway possui sobre você.
            </p>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setShowExportAlert(true)}
              aria-label="Exportar meus dados"
            >
              Exportar meus dados
            </Button>
          </div>

          <div className="border-t border-border pt-6">
            {privacyPolicyUrl ? (
              <Button variant="link" className="h-auto p-0 text-ink underline" asChild>
                <a
                  href={privacyPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ver política de privacidade"
                >
                  Ver política de privacidade
                </a>
              </Button>
            ) : (
              <p className="text-sm text-body">Política de privacidade em breve.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
