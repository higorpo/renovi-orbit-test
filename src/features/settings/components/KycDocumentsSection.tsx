import { Download, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type {
  KycOnboardingDocumentKey,
  KycOnboardingDocumentSlot,
} from "@/features/provider-kyc";
import { SettingsCardHeader } from "./SettingsCardHeader";

export type KycDocumentsSectionProps = {
  documents: KycOnboardingDocumentSlot[];
  downloadingKey: KycOnboardingDocumentKey | null;
  onDownload: (key: KycOnboardingDocumentKey) => void;
  supportHref: string;
};

export function KycDocumentsSection({
  documents,
  downloadingKey,
  onDownload,
  supportHref,
}: KycDocumentsSectionProps) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3 sm:pb-3">
        <SettingsCardHeader
          title="Documentos do cadastro"
          icon={FileText}
          description="Enviados no cadastro. Alterações só pelo suporte."
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-0 sm:pt-0">
        <ul className="divide-y divide-border">
          {documents.map((doc) => {
            const isDownloading = downloadingKey === doc.key;
            return (
              <li
                key={doc.key}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-ink">{doc.label}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{doc.helper}</p>
                  <p className="text-sm text-muted-foreground">{doc.fileName ?? "Não enviado"}</p>
                </div>
                {doc.storagePath ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full shrink-0 sm:w-auto"
                    aria-label={`Baixar ${doc.label}`}
                    disabled={isDownloading}
                    onClick={() => onDownload(doc.key)}
                  >
                    {isDownloading ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Download aria-hidden />
                    )}
                    Baixar
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Estes documentos não podem ser alterados por aqui. Se precisar atualizar algum arquivo,
          fale com o suporte.
        </p>
        <Button asChild variant="outline" className="h-11 w-full sm:w-auto">
          <a href={supportHref} target="_blank" rel="noopener noreferrer">
            Falar com o suporte
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
