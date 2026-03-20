import { CircleDollarSign, FileText, Image as ImageIcon, Percent } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import { useProviderProposalPhotoUrls } from "../hooks/useProviderProposalPhotoUrls";

interface ProviderProposalSummaryCardProps {
  job: ProviderJobItem;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function ProviderProposalSummaryCard({ job }: ProviderProposalSummaryCardProps) {
  const { urls, isLoading } = useProviderProposalPhotoUrls(job.provider_proposal_photos);
  if (!job.provider_proposal_id) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="text-base font-semibold text-foreground">Sua proposta enviada</h3>
      </CardHeader>
      <CardContent className="space-y-4 !pt-0">
        <div className="grid gap-2 sm:grid-cols-2">
          {typeof job.provider_proposed_amount === "number" && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
                Valor informado
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatCurrency(job.provider_proposed_amount)}
              </p>
            </div>
          )}

          {typeof job.provider_tax_amount === "number" && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Percent className="h-3.5 w-3.5" aria-hidden />
                Taxa da plataforma
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatCurrency(job.provider_tax_amount)}
                {typeof job.provider_tax_rate === "number"
                  ? ` (${(job.provider_tax_rate * 100).toFixed(0)}%)`
                  : ""}
              </p>
            </div>
          )}
        </div>

        {job.provider_proposal_description && (
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              Descrição enviada
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {job.provider_proposal_description}
            </p>
          </div>
        )}

        {(isLoading || urls.length > 0) && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" aria-hidden />
              Fotos da proposta
            </p>
            {isLoading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(job.provider_proposal_photos ?? []).slice(0, 4).map((_, index) => (
                  <div
                    key={index}
                    className="aspect-square animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {urls.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="aspect-square overflow-hidden rounded-lg border bg-muted"
                  >
                    <img
                      src={url}
                      alt={`Foto da proposta ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
