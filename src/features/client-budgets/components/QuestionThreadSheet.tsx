import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
        <SheetContent
          side="right"
          hideCloseButton
          className="flex w-full flex-col gap-0 border-l p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
        >
          <SheetHeader className="relative h-14 flex-row items-center space-y-0 border-b px-4 pr-16 sm:h-16 sm:px-6 sm:pr-20">
            <SheetTitle>Perguntas dos prestadores</SheetTitle>
            <SheetClose asChild>
              <button
                type="button"
                className="absolute right-4 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-background opacity-80 ring-offset-background transition-all hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none sm:right-6"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </button>
            </SheetClose>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {isLoading ? (
                  <Skeleton className="h-4 w-[min(100%,18rem)]" aria-hidden />
                ) : (
                  <p>{detail?.service_request.title ?? "—"}</p>
                )}
              </div>

              {isLoading ? (
                <div
                  className="space-y-3"
                  aria-busy="true"
                  aria-label="Carregando perguntas"
                >
                  {[0, 1].map((key) => (
                    <div key={key} className="space-y-3 rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-28" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </div>
                      <Skeleton className="h-20 w-full rounded-md" />
                      <Skeleton className="h-9 w-24" />
                    </div>
                  ))}
                </div>
              ) : questions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma pergunta para este pedido.
                </p>
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
