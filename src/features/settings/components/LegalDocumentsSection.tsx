import { ExternalLink, FileText, ScrollText, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LegalDocumentsSectionProps {
  termsOfUseUrl?: string | null;
  privacyPolicyUrl?: string | null;
  providerPlatformContractUrl?: string | null;
  showProviderContract?: boolean;
}

interface LegalDocRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}

function LegalDocRow({ icon: Icon, title, description, children }: LegalDocRowProps) {
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

function ExternalDocLink({
  href,
  label,
  buttonText,
  fallback,
}: {
  href?: string | null;
  label: string;
  buttonText: string;
  fallback: string;
}) {
  if (!href) {
    return <p className="text-sm text-muted-foreground">{fallback}</p>;
  }

  return (
    <Button variant="outline" size="sm" className="rounded-full" asChild>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="inline-flex items-center gap-1.5"
      >
        {buttonText}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </Button>
  );
}

/**
 * Official Prestway legal documents. Page title lives in SettingsSectionHeader /
 * mobile stack chrome — this section only renders the document list.
 */
export function LegalDocumentsSection({
  termsOfUseUrl,
  privacyPolicyUrl,
  providerPlatformContractUrl,
  showProviderContract = false,
}: LegalDocumentsSectionProps) {
  return (
    <div className="space-y-4" aria-label="Documentos jurídicos">
      <p className="text-caption text-muted-foreground">
        Termos, políticas e contratos oficiais da Prestway.
      </p>

      <ul className="m-0 list-none space-y-3 p-0">
        <li>
          <LegalDocRow
            icon={FileText}
            title="Termos de uso"
            description="Regras de uso da Prestway para clientes e prestadores."
          >
            <ExternalDocLink
              href={termsOfUseUrl}
              label="Ver termos de uso"
              buttonText="Ver termos"
              fallback="Termos de uso em breve."
            />
          </LegalDocRow>
        </li>

        <li>
          <LegalDocRow
            icon={Shield}
            title="Política de privacidade"
            description="Como coletamos, usamos e protegemos suas informações."
          >
            <ExternalDocLink
              href={privacyPolicyUrl}
              label="Ver política de privacidade"
              buttonText="Ver política"
              fallback="Política de privacidade em breve."
            />
          </LegalDocRow>
        </li>

        {showProviderContract ? (
          <li>
            <LegalDocRow
              icon={ScrollText}
              title="Contrato de uso da plataforma"
              description="Contrato de adesão para prestadores que usam a Prestway."
            >
              <ExternalDocLink
                href={providerPlatformContractUrl}
                label="Ver contrato de uso da plataforma"
                buttonText="Ver contrato"
                fallback="Contrato de uso da plataforma em breve."
              />
            </LegalDocRow>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
