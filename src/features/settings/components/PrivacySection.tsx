import { useState } from "react";
import { Download, ExternalLink, Mail, Shield } from "lucide-react";
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
import { DPO_EMAIL } from "../constants";

export interface PrivacySectionProps {
  privacyPolicyUrl?: string | null;
}

interface PrivacyActionRowProps {
  icon: typeof Shield;
  title: string;
  description: string;
  children: React.ReactNode;
}

function PrivacyActionRow({ icon: Icon, title, description, children }: PrivacyActionRowProps) {
  return (
    <article className="rounded-2xl border border-border bg-canvas p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink">
              {title}
            </h3>
            <p className="text-sm leading-relaxed text-body">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </article>
  );
}

/**
 * Privacy actions for the settings hub. Page title lives in SettingsSectionHeader /
 * mobile stack chrome — this section only renders the action list.
 */
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
                  Para solicitar a exportação dos seus dados pessoais, envie um e-mail para o
                  nosso encarregado de dados (DPO):
                </p>
                <p className="mt-3 font-semibold text-ink">
                  <a href={`mailto:${DPO_EMAIL}`} className="underline">
                    {DPO_EMAIL}
                  </a>
                </p>
                <p className="mt-3 text-sm">
                  Informe no e-mail que deseja solicitar a portabilidade dos seus dados conforme a
                  LGPD. Retornaremos em até 15 dias úteis.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowExportAlert(false)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4" aria-label="Privacidade e LGPD">
        <p className="text-caption text-muted-foreground">
          Direitos previstos na LGPD e canais oficiais da Prestway.
        </p>

        <ul className="m-0 list-none space-y-3 p-0">
          <li>
            <PrivacyActionRow
              icon={Mail}
              title="Falar com o DPO"
              description="Dúvidas sobre o tratamento dos seus dados ou exercício de direitos previstos na LGPD."
            >
              <Button variant="outline" size="sm" className="rounded-full" asChild>
                <a href={`mailto:${DPO_EMAIL}`} aria-label="Falar com o DPO">
                  Enviar e-mail
                </a>
              </Button>
            </PrivacyActionRow>
          </li>

          <li>
            <PrivacyActionRow
              icon={Download}
              title="Exportar meus dados"
              description="Solicite uma cópia dos dados que a Prestway possui sobre você."
            >
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setShowExportAlert(true)}
                aria-label="Exportar meus dados"
              >
                Solicitar exportação
              </Button>
            </PrivacyActionRow>
          </li>

          <li>
            <PrivacyActionRow
              icon={Shield}
              title="Política de privacidade"
              description="Como coletamos, usamos e protegemos suas informações."
            >
              {privacyPolicyUrl ? (
                <Button variant="outline" size="sm" className="rounded-full" asChild>
                  <a
                    href={privacyPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ver política de privacidade"
                    className="inline-flex items-center gap-1.5"
                  >
                    Ver política
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Política de privacidade em breve.</p>
              )}
            </PrivacyActionRow>
          </li>
        </ul>
      </div>
    </>
  );
}
