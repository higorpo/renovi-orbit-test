import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ClientQuestionServiceGroup } from "../types/client-budgets.types";
import { QuestionPreviewRow } from "./QuestionPreviewRow";
import { ServiceRequestSummaryBlock } from "./ServiceRequestSummaryBlock";

interface QuestionServiceCardProps {
  item: ClientQuestionServiceGroup;
  onOpenDetails: (serviceRequestId: string) => void;
}

export function QuestionServiceCard({ item, onOpenDetails }: QuestionServiceCardProps) {
  const location = [item.neighborhood, item.city].filter(Boolean).join(", ");
  const pendingQuestions = item.questions_preview.filter(
    (question) => question.client_responded_at === null && !question.client_response,
  );
  const previews = pendingQuestions.slice(0, 2);
  const extraCount = Math.max(pendingQuestions.length - previews.length, 0);
  const handleOpenDetails = () => onOpenDetails(item.service_request_id);

  return (
    <Card
      className="flex cursor-pointer flex-col transition-colors hover:border-primary/30"
      role="button"
      tabIndex={0}
      onClick={handleOpenDetails}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpenDetails();
        }
      }}
    >
      <CardHeader className="space-y-3 !pb-4">
        <ServiceRequestSummaryBlock
          serviceTitle={item.service_title}
          serviceRequestTitle={item.service_request_title}
          description={item.service_request_description}
          iconKey={item.service_icon_key}
          colorKey={item.service_color_key}
          location={location}
          createdAt={item.service_request_created_at}
        />
        <p className="text-xs font-medium text-muted-foreground">
          {item.pending_questions_count} pendente{item.pending_questions_count !== 1 ? "s" : ""} de{" "}
          {item.total_questions} pergunta{item.total_questions !== 1 ? "s" : ""} (até 3 por prestador)
        </p>
      </CardHeader>
      <CardContent className="space-y-2 !pt-0">
        {previews.map((question) => (
          <QuestionPreviewRow key={question.id} question={question} />
        ))}
        {extraCount > 0 ? (
          <p className="text-xs font-medium text-muted-foreground">+{extraCount} pergunta adicional</p>
        ) : null}
      </CardContent>
      <CardFooter className="border-t pt-3">
        <Button
          size="sm"
          className="h-9 min-h-9"
          onClick={(event) => {
            event.stopPropagation();
            handleOpenDetails();
          }}
        >
          Ver perguntas
        </Button>
      </CardFooter>
    </Card>
  );
}
