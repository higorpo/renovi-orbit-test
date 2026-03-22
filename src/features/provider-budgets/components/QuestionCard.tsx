import { Link } from "react-router";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Clock,
  Eye,
  MessageCircleQuestion,
  MessageCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getServiceCardStyle,
  useServiceRequestPhotoUrls,
} from "@/features/request-quote";
import { ImagePreviewStrip } from "@/components/ImagePreviewStrip";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { jobDetailPathFromBudgets } from "@/features/provider-jobs/constants/jobDetailReturnNavigation";
import type { JobDetailLocationState } from "@/features/provider-jobs/types/provider-jobs.types";
import type { ProviderOwnQuestion } from "../types/provider-budgets.types";
import { initialProviderJobItemFromOwnQuestion } from "../utils/initialProviderJobItem";
import { getQuestionStatusLabel } from "../constants/budgetStatus";

export interface QuestionCardProps {
  question: ProviderOwnQuestion;
  className?: string;
}

export function QuestionCard({ question, className }: QuestionCardProps) {
  const detailPath = jobDetailPathFromBudgets(question.service_request_id);
  const linkState: JobDetailLocationState = {
    job: initialProviderJobItemFromOwnQuestion(question),
    jobDetailPresentation: "sheet",
  };

  const { urls: photoUrls, isLoading: photoUrlsLoading } =
    useServiceRequestPhotoUrls(question.service_request_photos);

  const serviceStyle = getServiceCardStyle({
    icon_key: question.service_icon_key,
    color_key: question.service_color_key,
  });

  const statusConfig = getQuestionStatusLabel(question);
  const location = [question.neighborhood, question.city]
    .filter(Boolean)
    .join(", ");

  return (
    <Card
      className={cn(
        "flex flex-col transition-colors hover:border-primary/30",
        className,
      )}
    >
      <Link
        to={detailPath}
        state={linkState}
        className="contents"
        aria-label={`Ver detalhes: ${question.service_request_title}`}
      >
        <CardHeader className="!pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                  serviceStyle.color,
                )}
                aria-hidden
              >
                <serviceStyle.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {question.service_title}
                </p>
                <h2 className="mt-0.5 text-base font-semibold leading-tight sm:text-lg">
                  {question.service_request_title}
                </h2>
              </div>
            </div>

            <Badge variant={statusConfig.variant} className="shrink-0">
              {statusConfig.label}
            </Badge>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {location}
              </span>
            )}
            <span className="text-xs">{question.masked_client_name}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {formatRelativeDate(question.created_at)}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 !pt-0">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MessageCircleQuestion
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden
              />
              Sua pergunta
            </p>
            <p className="mt-1.5 line-clamp-3 text-sm text-foreground">
              {question.question}
            </p>
          </div>

          {question.client_response && (
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 dark:border-green-900 dark:bg-green-950/30">
              <p className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                <MessageCircle
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden
                />
                Resposta do cliente
              </p>
              <p className="mt-1.5 line-clamp-3 text-sm text-foreground">
                {question.client_response}
              </p>
            </div>
          )}

          {question.has_proposal && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Você também enviou um orçamento para este pedido
            </p>
          )}

          {(question.service_request_photos?.length ?? 0) > 0 && (
            <ImagePreviewStrip
              urls={photoUrls}
              isLoading={photoUrlsLoading}
            />
          )}
        </CardContent>
      </Link>

      <CardFooter className="mt-auto border-t pt-3">
        <Button variant="outline" size="sm" className="h-9 min-h-9" asChild>
          <Link
            to={detailPath}
            state={linkState}
            className="inline-flex items-center gap-1.5"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Ver pedido
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
