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
import { Shield } from "lucide-react";
import { DPO_EMAIL } from "../constants";

export interface PrivacySectionProps {
  privacyPolicyUrl?: string | null;
}

export function PrivacySection({
  privacyPolicyUrl,
}: PrivacySectionProps) {
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
                  Para solicitar a exportação dos seus dados pessoais, envie um
                  e-mail para o nosso encarregado de dados (DPO):
                </p>
                <p className="mt-3 font-semibold text-foreground">
                  <a href={`mailto:${DPO_EMAIL}`} className="underline">
                    {DPO_EMAIL}
                  </a>
                </p>
                <p className="mt-3 text-sm">
                  Informe no e-mail que deseja solicitar a portabilidade dos seus
                  dados conforme a LGPD. Retornaremos em até 15 dias úteis.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowExportAlert(false)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    <Card>
      <CardHeader className="pb-3 sm:pb-0">
        <SectionTitleWithIcon
          title="Privacidade e LGPD"
          icon={Shield}
          iconGradient="from-sky-500 to-blue-600"
          size="compact"
          className="!mb-0"
        />
      </CardHeader>
      <CardContent className="!pt-4 space-y-6">
        <div>
          <p className="text-sm mb-3">
            Se você tiver dúvidas sobre como tratamos seus dados pessoais ou quiser
            exercer seus direitos previstos na LGPD, fale com o nosso encarregado de
            dados.
          </p>
          <Button variant="outline" asChild>
            <a href={`mailto:${DPO_EMAIL}`} aria-label="Falar com o DPO">
              Falar com o DPO
            </a>
          </Button>
        </div>

        <div>
          <p className="text-sm mb-3">
            Baixe uma cópia dos dados que a Prestway possui sobre você.
          </p>
          <Button
            variant="outline"
            onClick={() => setShowExportAlert(true)}
            aria-label="Exportar meus dados"
          >
            Exportar meus dados
          </Button>
        </div>

        {privacyPolicyUrl ? (
          <div>
            <Button variant="link" className="p-0 h-auto underline" asChild>
              <a
                href={privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ver política de privacidade"
              >
                Ver política de privacidade
              </a>
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm">
              Política de privacidade em breve.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
