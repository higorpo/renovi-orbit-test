import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";

export interface CreateProviderJobQuestionParams {
  serviceRequestId: string;
  question: string;
}

export interface CreateProviderJobQuestionResponse {
  id: string;
  created_at: string;
}

function isCreateProviderJobQuestionResponse(
  value: unknown,
): value is CreateProviderJobQuestionResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.created_at === "string"
  );
}

export async function createProviderJobQuestion(
  params: CreateProviderJobQuestionParams,
): Promise<{ data: CreateProviderJobQuestionResponse | null; error: string | null }> {
  const { data, error } = await supabase.rpc(
    "create_provider_service_request_question",
    {
      p_service_request_id: params.serviceRequestId,
      p_question: params.question,
    },
  );

  if (error) {
    logger.error("create_provider_job_question_error", {
      error: error.message,
      serviceRequestId: params.serviceRequestId,
    });
    return { data: null, error: error.message };
  }

  if (!isCreateProviderJobQuestionResponse(data)) {
    logger.error("create_provider_job_question_invalid_response", {
      serviceRequestId: params.serviceRequestId,
      data,
    });
    return { data: null, error: "Unexpected response from server" };
  }

  return { data, error: null };
}
