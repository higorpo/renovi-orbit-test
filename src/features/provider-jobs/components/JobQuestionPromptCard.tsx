import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

interface JobQuestionPromptCardProps {
  suggestedQuestions: string[];
  onAskQuestion: () => void;
  onUseSuggestedQuestion: (question: string) => void;
}

export function JobQuestionPromptCard({
  suggestedQuestions,
  onAskQuestion,
  onUseSuggestedQuestion,
}: JobQuestionPromptCardProps) {
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
      <h3 className="text-base font-semibold text-foreground">
        Você tem alguma dúvida?
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Faça uma pergunta para o cliente e aguarde a resposta dele. Você
        pode escrever qualquer pergunta ou usar uma das perguntas sugeridas
        abaixo.
      </p>
      <p className="mt-1 text-xs font-medium text-primary">
        Limite: até 3 perguntas por pedido.
      </p>
      <Button
        type="button"
        className="mt-3"
        onClick={onAskQuestion}
      >
        Fazer pergunta
      </Button>

      <Accordion type="single" collapsible className="mt-3 w-full">
        <AccordionItem value="suggested-questions">
          <AccordionTrigger>
            Ver perguntas sugeridas
          </AccordionTrigger>
          <AccordionContent>
            {suggestedQuestions.length > 0 ? (
              <div className="space-y-2">
                {suggestedQuestions.map((question, index) => (
                  <div
                    key={`${question}-${index}`}
                    className="rounded-lg border bg-background p-3"
                  >
                    <p className="text-sm text-foreground">{question}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => onUseSuggestedQuestion(question)}
                    >
                      Usar pergunta sugerida
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Não há perguntas sugeridas para este pedido no momento.
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
