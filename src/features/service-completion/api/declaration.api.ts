/**
 * Persist client execution declaration via Edge Function.
 */

import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { DeviceDeclarationPayload } from "../types/declaration.types";

export type RecordExecutionDeclarationInput = DeviceDeclarationPayload & {
  contractedServiceId: string;
};

export type RecordExecutionDeclarationSuccess = {
  ok: true;
  id: string | null;
  contractedServiceId: string;
  declaredAt: string | null;
  lastSeenAt: string | null;
};

export type RecordExecutionDeclarationResult = {
  data: RecordExecutionDeclarationSuccess | null;
  error: string | null;
  errorCode?: string;
};

async function readFunctionsHttpErrorMessage(
  error: FunctionsHttpError,
): Promise<string> {
  try {
    const body = await error.context.json();
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      if (typeof record.error === "string" && record.error.trim()) {
        return record.error.trim();
      }
      if (typeof record.message === "string" && record.message.trim()) {
        return record.message.trim();
      }
    }
  } catch {
    // fall through
  }
  return error.message;
}

export async function recordExecutionDeclaration(
  input: RecordExecutionDeclarationInput,
): Promise<RecordExecutionDeclarationResult> {
  const contractedServiceId = input.contractedServiceId?.trim();
  if (!contractedServiceId) {
    return {
      data: null,
      error: "contracted_service_id_required",
      errorCode: "contracted_service_id_required",
    };
  }

  const { data, error } = await supabase.functions.invoke(
    "record-service-completion-declaration",
    {
      body: {
        contractedServiceId,
        deviceId: input.deviceId,
        platform: input.platform,
        operatingSystem: input.operatingSystem,
        osVersion: input.osVersion,
        manufacturer: input.manufacturer,
        model: input.model,
        deviceName: input.deviceName,
        isVirtual: input.isVirtual,
        webViewVersion: input.webViewVersion,
        userAgent: input.userAgent,
        clientTimezone: input.clientTimezone,
      },
    },
  );

  if (error) {
    const message =
      error instanceof FunctionsHttpError
        ? await readFunctionsHttpErrorMessage(error)
        : error.message;
    logger.warn("record_execution_declaration_failed", {
      feature: "service_completion",
      outcome: "declaration",
      contracted_service_id: contractedServiceId,
      error: message,
    });
    return {
      data: null,
      error: message,
      errorCode: message,
    };
  }

  const payload =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;

  if (!payload || payload.ok !== true) {
    const message =
      typeof payload?.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : "declaration_failed";
    logger.warn("record_execution_declaration_rejected", {
      feature: "service_completion",
      outcome: "declaration",
      contracted_service_id: contractedServiceId,
      error: message,
    });
    return { data: null, error: message, errorCode: message };
  }

  return {
    data: {
      ok: true,
      id: typeof payload.id === "string" ? payload.id : null,
      contractedServiceId:
        typeof payload.contractedServiceId === "string"
          ? payload.contractedServiceId
          : contractedServiceId,
      declaredAt:
        typeof payload.declaredAt === "string" ? payload.declaredAt : null,
      lastSeenAt:
        typeof payload.lastSeenAt === "string" ? payload.lastSeenAt : null,
    },
    error: null,
  };
}
