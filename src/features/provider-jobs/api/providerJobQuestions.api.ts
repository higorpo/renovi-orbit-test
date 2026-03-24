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

export interface ProviderJobQuestionItem {
  id: string;
  question: string;
  client_response: string | null;
  client_response_images: string[];
  created_at: string;
  client_responded_at: string | null;
  is_own_question: boolean;
  provider_first_name: string | null;
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

export async function listProviderJobQuestions(
  serviceRequestId: string,
): Promise<{ data: ProviderJobQuestionItem[] | null; error: string | null }> {
  const supabaseClient = supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await supabaseClient.rpc(
    "list_provider_service_request_questions",
    {
      p_service_request_id: serviceRequestId,
    },
  );

  if (error) {
    logger.error("list_provider_job_questions_error", {
      error: error.message,
      serviceRequestId,
    });
    return { data: null, error: error.message };
  }

  if (!Array.isArray(data)) {
    logger.error("list_provider_job_questions_invalid_response", {
      serviceRequestId,
      data,
    });
    return { data: null, error: "Unexpected response from server" };
  }

  return { data: data as ProviderJobQuestionItem[], error: null };
}
