import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import { Shield } from "lucide-react";
import { DPO_EMAIL } from "../constants";

export interface PrivacySectionProps {
  onExportData?: () => void;
  isExporting?: boolean;
  privacyPolicyUrl?: string | null;
}

export function PrivacySection({
  onExportData,
  isExporting,
  privacyPolicyUrl,
}: PrivacySectionProps) {
  return (
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
          <p className="text-sm text-muted-foreground mb-3">
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
          <p className="text-sm text-muted-foreground mb-3">
            Baixe uma cópia dos dados que a Renovi possui sobre você.
          </p>
          <Button
            variant="outline"
            onClick={onExportData}
            disabled={isExporting}
            aria-label="Exportar meus dados"
          >
            {isExporting ? "Preparando…" : "Exportar meus dados"}
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
            <p className="text-sm text-muted-foreground">
              Política de privacidade em breve.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
