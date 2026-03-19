import type { ComponentType } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  MapPin,
  Clock,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Wrench,
  Package,
  Tag,
  Timer,
  Briefcase,
  Loader2,
  CircleHelp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getServiceCardStyle } from "@/features/request-quote";
import { useServiceRequestPhotoUrls } from "@/features/request-quote";
import { formatDistance } from "@/lib/formatDistance";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { FormResponsesSummary } from "./FormResponsesSummary";
import { useProviderJobDetail } from "../hooks/useProviderJobDetail";
import { MAX_PROPOSALS_PER_REQUEST } from "../types/provider-jobs.types";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import {
  mapSuggestedEquipmentToPt,
  mapSuggestedMaterialsToPt,
} from "../utils/suggestedItemsMapper";
import type { EstimatedDurationHintKey } from "supabase/functions/generate-smart-description/allowedValues";

const DURATION_LABELS: Record<EstimatedDurationHintKey, string> = {
  under_1h: "Menos de 1 hora",
  "1_to_2h": "1 a 2 horas",
  "2_to_4h": "2 a 4 horas",
  "4_to_8h": "4 a 8 horas",
  "1_day": "1 dia",
  "1_to_2_days": "1 a 2 dias",
  "2_to_5_days": "2 a 5 dias",
  "5_to_10_days": "5 a 10 dias",
  "10_to_20_days": "10 a 20 dias",
  "20_to_30_days": "20 a 30 dias",
  "over_30_days": "Mais de 30 dias",
};

const URGENCY_CONFIG: Record<string, { label: string; variant: "destructive" | "warning" | "default" }> = {
  high: { label: "Urgente", variant: "destructive" },
  medium: { label: "Média prioridade", variant: "warning" },
  low: { label: "Baixa prioridade", variant: "default" },
};

const COMPLEXITY_LABELS: Record<string, string> = {
  simple: "Simples",
  medium: "Média",
  complex: "Complexo",
};

const SUGGESTED_ITEMS_TOOLTIP_TEXT =
  "Itens sugeridos com base no pedido de orçamento do cliente. Eles podem ser utilizados, mas podem estar imprecisos.";

function SuggestedItemsInfo({ ariaLabel }: { ariaLabel: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={ariaLabel}
        >
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-xs leading-relaxed" align="start">
        {SUGGESTED_ITEMS_TOOLTIP_TEXT}
      </PopoverContent>
    </Popover>
  );
}

function PhotoGallery({ photos }: { photos: string[] }) {
  const { urls, isLoading } = useServiceRequestPhotoUrls(photos);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.slice(0, 6).map((_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  if (urls.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="list" aria-label="Fotos do pedido">
      {urls.map((url, i) => (
        <div
          key={i}
          className="aspect-square overflow-hidden rounded-lg border bg-muted"
          role="listitem"
        >
          {url ? (
            <img
              src={url}
              alt={`Foto ${i + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="h-full w-full bg-muted" />
          )}
        </div>
      ))}
    </div>
  );
}

function MetadataBadges({ job }: { job: ProviderJobItem }) {
  const items: Array<{
    icon: ComponentType<{ className?: string }>;
    label: string;
    className?: string;
  }> = [];

  if (job.estimated_duration_hint && DURATION_LABELS[job.estimated_duration_hint as EstimatedDurationHintKey]) {
    items.push({
      icon: Timer,
      label: DURATION_LABELS[job.estimated_duration_hint as EstimatedDurationHintKey] + ' (aprox.)',
    });
  }

  if (job.scope_complexity) {
    items.push({
      icon: Wrench,
      label: `Complexidade: ${COMPLEXITY_LABELS[job.scope_complexity] ?? job.scope_complexity}`,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ icon: Icon, label, className }) => (
        <span
          key={label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground",
            className,
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

export function JobDetailContent({ job }: { job: ProviderJobItem }) {
  const serviceStyle = getServiceCardStyle({
    icon_key: job.service_icon_key,
    color_key: job.service_color_key,
  });
  const suggestedEquipmentPt = mapSuggestedEquipmentToPt(job.suggested_equipment);
  const suggestedMaterialsPt = mapSuggestedMaterialsToPt(job.suggested_materials);

  const urgencyConfig = job.urgency ? URGENCY_CONFIG[job.urgency] : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
              serviceStyle.color,
            )}
            aria-hidden
          >
            <serviceStyle.Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              {job.service_title}
            </p>
            <h1 className="mt-0.5 text-xl font-bold leading-tight sm:text-2xl">
              {job.title}
            </h1>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {urgencyConfig && (
            <Badge variant={urgencyConfig.variant}>
              <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
              {urgencyConfig.label}
            </Badge>
          )}
          {job.exact_area_match && (
            <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
              <CheckCircle className="h-3 w-3" aria-hidden />
              Na sua área
            </Badge>
          )}
          <Badge variant="secondary">
            <MessageSquare className="mr-1 h-3 w-3" aria-hidden />
            {job.proposal_count} de {MAX_PROPOSALS_PER_REQUEST} propostas
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {job.neighborhood}, {job.city} ({job.state})
          </span>
          <span className="font-medium text-foreground">
            {formatDistance(job.distance_km)} de você
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0" aria-hidden />
            {formatRelativeDate(job.created_at)}
          </span>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Solicitante: {job.masked_client_name}
        </p>
      </CardHeader>

      <Separator />

      <CardContent className="space-y-6 pt-4">
        <MetadataBadges job={job} />

        {job.description && (
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Descrição
            </h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
              {job.description}
            </p>
          </div>
        )}

        <FormResponsesSummary
          formData={job.form_data}
          formSchema={job.form_schema}
        />

        {job.photos && job.photos.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Fotos ({job.photos.length})
            </h3>
            <div className="mt-2">
              <PhotoGallery photos={job.photos} />
            </div>
          </div>
        )}

        {job.tags && job.tags.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground">Tags</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {job.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  <Tag className="h-3 w-3" aria-hidden />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {suggestedEquipmentPt.length > 0 && (
          <div>
            <div className="flex items-center">
              <h3 className="text-sm font-semibold text-foreground">
                Equipamentos que podem ser úteis
              </h3>
              <SuggestedItemsInfo ariaLabel="Mais informações sobre equipamentos sugeridos" />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {suggestedEquipmentPt.map((eq) => (
                <span
                  key={eq}
                  className="inline-flex items-center gap-1 rounded-full border bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                >
                  <Wrench className="h-3 w-3" aria-hidden />
                  {eq}
                </span>
              ))}
            </div>
          </div>
        )}

        {suggestedMaterialsPt.length > 0 && (
          <div>
            <div className="flex items-center">
              <h3 className="text-sm font-semibold text-foreground">
                Materiais que podem ser úteis
              </h3>
              <SuggestedItemsInfo ariaLabel="Mais informações sobre materiais sugeridos" />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {suggestedMaterialsPt.map((mat) => (
                <span
                  key={mat}
                  className="inline-flex items-center gap-1 rounded-full border bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                >
                  <Package className="h-3 w-3" aria-hidden />
                  {mat}
                </span>
              ))}
            </div>
          </div>
        )}

        {job.suggested_questions && job.suggested_questions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Perguntas sugeridas
            </h3>
            <div className="mt-2 space-y-2">
              {job.suggested_questions.map((question, index) => (
                <div
                  key={`${question}-${index}`}
                  className="rounded-lg border bg-muted/20 p-3"
                >
                  <p className="text-sm text-foreground">{question}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                  >
                    Perguntar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function JobDetailNotFound() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Briefcase className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold">
        Trabalho não encontrado
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Este trabalho pode não estar mais disponível. Volte para a lista de
        trabalhos para ver oportunidades atuais.
      </p>
      <Button variant="outline" size="sm" asChild className="mt-4">
        <Link to="/dashboard/jobs">Ver trabalhos</Link>
      </Button>
    </div>
  );
}

function JobDetailBackLink() {
  return (
    <div className="mb-4">
      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <Link to="/dashboard/jobs">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para Trabalhos
        </Link>
      </Button>
    </div>
  );
}

export function JobDetailPage({ jobId }: { jobId: string }) {
  const { job, isLoading, isError, refetch } = useProviderJobDetail(jobId);

  return (
    <div className="container max-w-3xl px-4 py-6">
      <JobDetailBackLink />

      {isLoading && (
        <div
          className="flex justify-center py-16"
          aria-busy="true"
          aria-label="Carregando detalhes do trabalho"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar este trabalho.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            type="button"
            onClick={() => refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {!isLoading && !isError && job && <JobDetailContent job={job} />}

      {!isLoading && !isError && !job && <JobDetailNotFound />}
    </div>
  );
}
