import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useQuestionResponseImageUrls } from "@/features/client-budgets/hooks/useQuestionResponseImageUrls";
import { useProviderJobQuestions } from "../hooks/useProviderJobQuestions";

function formatQuestionDateTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

function QuestionResponseImages({ paths }: { paths: string[] }) {
  const { urls, isLoading } = useQuestionResponseImageUrls(paths);

  if (paths.length === 0) return null;

  if (isLoading) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {paths.slice(0, 5).map((path, index) => (
          <div
            key={`${path}-${index}`}
            className="aspect-[4/3] w-full animate-pulse rounded-md border bg-muted"
          />
        ))}
      </div>
    );
  }

  if (urls.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((url, index) => (
        <div
          key={`${url}-${index}`}
          className="aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted"
        >
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

export function JobQuestionsFeed({ serviceRequestId }: { serviceRequestId: string }) {
  const { items, isLoading, isError, refetch } = useProviderJobQuestions(serviceRequestId);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-foreground">
          Perguntas deste trabalho
        </h3>
        <p className="text-sm text-muted-foreground">
          Suas perguntas aparecem sempre. Perguntas de outros profissionais só
          são exibidas quando já tiverem resposta do cliente.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 !pt-0">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Carregando perguntas...</p>
        )}

        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as perguntas.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Ainda não há perguntas para este trabalho.
          </p>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border bg-muted/15 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant={item.is_own_question ? "default" : "secondary"}>
                    {item.is_own_question
                      ? "Pergunta feita por você"
                      : `Pergunta de ${item.provider_first_name ?? "profissional"}`}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Perguntada em {formatQuestionDateTime(item.created_at)}
                  </span>
                </div>

                <p className="text-sm text-foreground">{item.question}</p>

                {(item.client_response || (item.client_response_images?.length ?? 0) > 0) && (
                  <div className="mt-3 rounded-md border bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Resposta do cliente
                    </p>
                    {item.client_response ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {item.client_response}
                      </p>
                    ) : null}
                    <QuestionResponseImages paths={item.client_response_images ?? []} />
                    {item.client_responded_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Respondida em {formatQuestionDateTime(item.client_responded_at)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
