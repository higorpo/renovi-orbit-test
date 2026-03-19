import { useLocation, Link } from "react-router";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getServiceCardStyle } from "@/features/request-quote";
import { useServiceRequestPhotoUrls } from "@/features/request-quote";
import { formatDistance } from "@/lib/formatDistance";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { FormResponsesSummary } from "./FormResponsesSummary";
import { MAX_PROPOSALS_PER_REQUEST } from "../types/provider-jobs.types";
import type { ProviderJobItem } from "../types/provider-jobs.types";

const DURATION_LABELS: Record<string, string> = {
  under_1h: "Menos de 1 hora",
  "1_to_2h": "1 a 2 horas",
  "2_to_4h": "2 a 4 horas",
  "4_to_8h": "4 a 8 horas",
  "1_day": "1 dia",
  "1_to_2_days": "1 a 2 dias",
  "2_to_5_days": "2 a 5 dias",
  "5_to_10_days": "5 a 10 dias",
  over_10_days: "Mais de 10 dias",
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
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    className?: string;
  }> = [];

  if (job.estimated_duration_hint) {
    items.push({
      icon: Timer,
      label: DURATION_LABELS[job.estimated_duration_hint] ?? job.estimated_duration_hint,
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

function JobDetailContent({ job }: { job: ProviderJobItem }) {
  const serviceStyle = getServiceCardStyle({
    icon_key: job.service_icon_key,
    color_key: job.service_color_key,
  });

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

        {job.suggested_equipment && job.suggested_equipment.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Equipamentos sugeridos
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {job.suggested_equipment.map((eq) => (
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

        {job.suggested_materials && job.suggested_materials.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Materiais sugeridos
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {job.suggested_materials.map((mat) => (
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
      </CardContent>
    </Card>
  );
}

function JobNotFound() {
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

export function JobDetailPage() {
  const location = useLocation();
  const job = (location.state as { job?: ProviderJobItem } | null)?.job ?? null;

  return (
    <div className="container max-w-3xl px-4 py-6">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link to="/dashboard/jobs">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar para Trabalhos
          </Link>
        </Button>
      </div>

      {job ? <JobDetailContent job={job} /> : <JobNotFound />}
    </div>
  );
}
