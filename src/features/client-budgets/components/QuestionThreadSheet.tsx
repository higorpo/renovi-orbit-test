import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { ProviderProfileInlinePreview } from "@/features/provider-profile";
import { useClientBudgetDetail } from "../hooks/useClientBudgetDetail";
import { useQuestionResponseImageUrls } from "../hooks/useQuestionResponseImageUrls";
import { QuestionStatusBadge } from "./QuestionStatusBadge";
import { QuestionResponseComposer } from "./QuestionResponseComposer";

interface QuestionThreadSheetProps {
  open: boolean;
  serviceRequestId: string | null;
  onOpenChange: (open: boolean) => void;
}

function ResponseImages({ paths }: { paths: string[] }) {
  const { urls, isLoading } = useQuestionResponseImageUrls(paths);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {paths.slice(0, 3).map((path, index) => (
          <div
            key={`${path}-${index}`}
            className="h-28 w-full animate-pulse rounded-md border bg-muted"
          />
        ))}
      </div>
    );
  }

  if (urls.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((url, index) => (
        <div key={`${url}-${index}`} className="h-28 w-full overflow-hidden rounded-md border bg-muted">
          <img
            src={url}
            alt={`Imagem da resposta ${index + 1}`}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function QuestionThreadSheet({ open, serviceRequestId, onOpenChange }: QuestionThreadSheetProps) {
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const { detail, isLoading } = useClientBudgetDetail(serviceRequestId);
  const questions = useMemo(() => {
    const baseQuestions = detail?.questions ?? [];
    return [...baseQuestions].sort((a, b) => {
      const aPending = a.client_response ? 1 : 0;
      const bPending = b.client_response ? 1 : 0;
      if (aPending !== bPending) return aPending - bPending;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [detail?.questions]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full max-w-none overflow-y-auto p-0 sm:max-w-2xl">
          <div className="space-y-4 p-4 sm:p-6">
            <SheetHeader className="space-y-2 text-left">
              <SheetTitle>Perguntas dos prestadores</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {detail?.service_request.title ?? "Carregando..."}
              </p>
            </SheetHeader>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando perguntas...</p>
            ) : questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma pergunta para este pedido.</p>
            ) : (
              <div className="space-y-3">
                {questions.map((question) => (
                  <div key={question.id} className="space-y-3 rounded-lg border p-3">
                    <ProviderProfileInlinePreview
                      providerName={question.provider_name}
                      providerSlug={question.provider_slug}
                      providerProfileImagePath={question.provider_profile_image_path}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{formatRelativeDate(question.created_at)}</p>
                      <QuestionStatusBadge
                        clientResponse={question.client_response}
                        clientRespondedAt={question.client_responded_at}
                        serviceRequestStatus={detail?.service_request.status}
                      />
                    </div>
                    <p className="rounded-md bg-muted/40 p-2.5 text-sm">{question.question}</p>
                    {question.client_response ? (
                      <div className="space-y-2 rounded-md border border-green-200 bg-green-50/40 p-2.5 dark:border-green-900 dark:bg-green-950/30">
                        <p className="text-xs font-medium text-green-700 dark:text-green-400">
                          Sua resposta
                        </p>
                        <p className="text-sm">{question.client_response}</p>
                        <ResponseImages paths={question.client_response_images ?? []} />
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setActiveQuestionId(question.id)}>
                        Responder
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      {serviceRequestId && activeQuestionId ? (
        <QuestionResponseComposer
          open={Boolean(activeQuestionId)}
          onOpenChange={(next) => {
            if (!next) setActiveQuestionId(null);
          }}
          serviceRequestId={serviceRequestId}
          questionId={activeQuestionId}
        />
      ) : null}
    </>
  );
}
