import { Badge } from "@/components/ui/badge";
import { getQuestionStatusConfig } from "../constants/status";

export function QuestionStatusBadge({
  clientResponse,
  clientRespondedAt,
  serviceRequestStatus,
}: {
  clientResponse: string | null;
  clientRespondedAt: string | null;
  serviceRequestStatus?: string | null;
}) {
  const config = getQuestionStatusConfig({
    client_response: clientResponse,
    client_responded_at: clientRespondedAt,
    service_request_status: serviceRequestStatus ?? null,
  });
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
