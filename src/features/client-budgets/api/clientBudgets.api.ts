import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";
import type {
  ClientBudgetDetail,
  ClientQuestionServiceGroup,
  ClientReceivedServiceGroup,
  PaginatedResponse,
} from "../types/client-budgets.types";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const QUESTION_RESPONSES_BUCKET = "client-question-responses";
const SIGNED_URL_EXPIRY_SEC = 3600;
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

function isPaginatedResponse(value: unknown): value is PaginatedResponse<unknown> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.items) &&
    typeof v.total_count === "number" &&
    typeof v.page === "number" &&
    typeof v.page_size === "number"
  );
}

export async function fetchClientReceivedBudgets(params: {
  page: number;
  pageSize: number;
  status: string | null;
  search: string | null;
}): Promise<{ data: PaginatedResponse<ClientReceivedServiceGroup> | null; error: string | null }> {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("list_client_received_budgets", {
    p_page: params.page,
    p_page_size: params.pageSize,
    p_status: params.status,
    p_search: params.search,
  });

  if (error) {
    logger.error("fetch_client_received_budgets_error", { error: error.message });
    return { data: null, error: error.message };
  }
  if (!isPaginatedResponse(data)) {
    logger.error("fetch_client_received_budgets_invalid_response", { data });
    return { data: null, error: "Unexpected response from server" };
  }
  return { data: data as PaginatedResponse<ClientReceivedServiceGroup>, error: null };
}

export async function fetchClientBudgetQuestions(params: {
  page: number;
  pageSize: number;
  questionStatus: string | null;
  search: string | null;
}): Promise<{ data: PaginatedResponse<ClientQuestionServiceGroup> | null; error: string | null }> {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("list_client_budget_questions", {
    p_page: params.page,
    p_page_size: params.pageSize,
    p_question_status: params.questionStatus,
    p_search: params.search,
  });

  if (error) {
    logger.error("fetch_client_budget_questions_error", { error: error.message });
    return { data: null, error: error.message };
  }
  if (!isPaginatedResponse(data)) {
    logger.error("fetch_client_budget_questions_invalid_response", { data });
    return { data: null, error: "Unexpected response from server" };
  }
  return { data: data as PaginatedResponse<ClientQuestionServiceGroup>, error: null };
}

export async function fetchClientBudgetDetail(serviceRequestId: string): Promise<{
  data: ClientBudgetDetail | null;
  error: string | null;
}> {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("get_client_budget_service_request_detail", {
    p_service_request_id: serviceRequestId,
  });
  if (error) {
    logger.error("fetch_client_budget_detail_error", { error: error.message, serviceRequestId });
    return { data: null, error: error.message };
  }
  if (!data || typeof data !== "object") {
    logger.error("fetch_client_budget_detail_invalid_response", { data, serviceRequestId });
    return { data: null, error: "Unexpected response from server" };
  }
  return { data: data as ClientBudgetDetail, error: null };
}

export async function respondClientBudgetQuestion(params: {
  questionId: string;
  response: string;
  imagePaths: string[];
}) {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("respond_client_budget_question", {
    p_question_id: params.questionId,
    p_response: params.response,
    p_response_images: params.imagePaths,
  });
  if (error) {
    logger.error("respond_client_budget_question_error", { error: error.message, questionId: params.questionId });
    return { error: error.message, data: null as unknown };
  }
  return { error: null, data };
}

export async function rejectClientBudgetProposal(params: { proposalId: string; reason: string }) {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("reject_client_budget_proposal", {
    p_proposal_id: params.proposalId,
    p_reason: params.reason,
  });
  if (error) {
    logger.error("reject_client_budget_proposal_error", {
      error: error.message,
      proposalId: params.proposalId,
    });
    return { error: error.message, data: null as unknown };
  }
  return { error: null, data };
}

function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return "Formato não permitido. Use JPEG, PNG, WebP, HEIC ou HEIF.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Cada imagem deve ter no máximo 5 MB.";
  }
  return null;
}

export async function uploadQuestionResponseImages(params: {
  serviceRequestId: string;
  questionId: string;
  files: File[];
}): Promise<{ paths: string[]; error: string | null }> {
  if (params.files.length === 0) return { paths: [], error: null };
  if (params.files.length > MAX_IMAGES) {
    return { paths: [], error: `Você pode anexar no máximo ${MAX_IMAGES} imagens.` };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { paths: [], error: authError?.message ?? "Usuário não autenticado" };

  const uploadedPaths: string[] = [];
  for (let i = 0; i < params.files.length; i++) {
    const file = params.files[i];
    const validationError = validateImage(file);
    if (validationError) return { paths: uploadedPaths, error: validationError };

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext) ? ext : "jpg";
    const path = `clients/${user.id}/question-responses/${params.serviceRequestId}/${params.questionId}/${Date.now()}-${i}.${safeExt}`;
    const { error } = await supabase.storage
      .from(QUESTION_RESPONSES_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (error) {
      logger.error("upload_question_response_image_error", {
        error: error.message,
        questionId: params.questionId,
      });
      return { paths: uploadedPaths, error: error.message };
    }
    uploadedPaths.push(path);
  }

  return { paths: uploadedPaths, error: null };
}

export async function getQuestionResponseImageUrl(path: string): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const { data, error } = await supabase.storage
    .from(QUESTION_RESPONSES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SEC);
  if (error) return "";
  return data?.signedUrl ?? "";
}
