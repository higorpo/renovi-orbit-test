import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";
import type {
  ProviderSentBudget,
  ProviderOwnQuestion,
  PaginatedResponse,
} from "../types/provider-budgets.types";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function isPaginatedResponse(value: unknown): value is {
  items: unknown[];
  total_count: number;
  page: number;
  page_size: number;
} {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const tc = v.total_count;
  const p = v.page;
  const ps = v.page_size;
  return (
    Array.isArray(v.items) &&
    typeof tc === "number" &&
    typeof p === "number" &&
    typeof ps === "number" &&
    Number.isFinite(tc) &&
    Number.isFinite(p) &&
    Number.isFinite(ps) &&
    ps > 0
  );
}

export interface FetchProviderSentBudgetsParams {
  page: number;
  pageSize: number;
  status: string | null;
  search: string | null;
}

export async function fetchProviderSentBudgets(
  params: FetchProviderSentBudgetsParams,
): Promise<{
  data: PaginatedResponse<ProviderSentBudget> | null;
  error: string | null;
}> {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("list_provider_sent_budgets", {
    p_page: params.page,
    p_page_size: params.pageSize,
    p_status: params.status,
    p_search: params.search,
  });

  if (error) {
    logger.error("fetch_provider_sent_budgets_error", { error: error.message });
    return { data: null, error: error.message };
  }

  if (!isPaginatedResponse(data)) {
    logger.error("fetch_provider_sent_budgets_invalid_response", { data });
    return { data: null, error: "Unexpected response from server" };
  }

  return {
    data: data as PaginatedResponse<ProviderSentBudget>,
    error: null,
  };
}

export interface FetchProviderOwnQuestionsParams {
  page: number;
  pageSize: number;
  questionStatus: string | null;
  search: string | null;
}

export async function fetchProviderOwnQuestions(
  params: FetchProviderOwnQuestionsParams,
): Promise<{
  data: PaginatedResponse<ProviderOwnQuestion> | null;
  error: string | null;
}> {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("list_provider_own_questions", {
    p_page: params.page,
    p_page_size: params.pageSize,
    p_question_status: params.questionStatus,
    p_search: params.search,
  });

  if (error) {
    logger.error("fetch_provider_own_questions_error", { error: error.message });
    return { data: null, error: error.message };
  }

  if (!isPaginatedResponse(data)) {
    logger.error("fetch_provider_own_questions_invalid_response", { data });
    return { data: null, error: "Unexpected response from server" };
  }

  return {
    data: data as PaginatedResponse<ProviderOwnQuestion>,
    error: null,
  };
}
