import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useProviderJobQuestions } from "../hooks/useProviderJobQuestions";

function formatQuestionDateTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
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
          <p className="text-sm text-muted-foreground">
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

                {item.client_response && (
                  <div className="mt-3 rounded-md border bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Resposta do cliente
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {item.client_response}
                    </p>
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
