/**
 * Sequential checkout item processing (design §5.5, task 69).
 * One dispatch at a time: render → send → await report before the next item.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "../_shared/logger.ts";
import { withSpan } from "../_shared/sentrySpans.ts";
import { classifyProviderFailure } from "./httpClassifier.ts";
import { FcmConfigError, sendFcmPush, type SendFcmPushInput } from "./fcm.ts";
import {
  buildPushDeliveryReportPayload,
  reportDeliveryOutcome,
  type PushDeliverySendResult,
  type ReportDeliveryOutcomeInput,
  type ReportDeliveryOutcomeResult,
} from "./report.ts";
import { renderEmailFromTemplate } from "./renderEmail.ts";
import { validateAndRenderPush } from "./renderPush.ts";
import { InbucketConfigError, sendInbucketEmail } from "./inbucketEmail.ts";
import { ResendConfigError, sendResendEmail, type SendResendEmailInput } from "./resend.ts";
import { fetchEmailTemplate, fetchPushTemplate } from "./templates.ts";
import { TemplateVariablesSizeError } from "./templateVariables.ts";
import { TemplateSchemaValidationError } from "./validateTemplateSchema.ts";
import { WORKER_WALL_CLOCK_BUDGET_MS } from "./constants.ts";
import {
  createWorkerWallClockBudget,
  isWorkerWallClockExceeded,
  workerWallClockElapsedMs,
  type WorkerWallClockBudget,
} from "./workerBudget.ts";
import type { CheckoutDispatchDto, WorkerRunResult } from "./types.ts";

const log = createLogger("message-dispatcher-worker");

function failureCodeFromError(err: unknown): string {
  if (err instanceof TemplateVariablesSizeError) return err.code;
  if (err instanceof TemplateSchemaValidationError) return err.code;
  return "template_render_error";
}

export interface DispatchProcessCounts {
  renderFailed: number;
  sendSucceeded: number;
  sendFailed: number;
}

export interface ProcessDispatchDeps {
  fetchEmailTemplate: typeof fetchEmailTemplate;
  fetchPushTemplate: typeof fetchPushTemplate;
  renderEmailFromTemplate: typeof renderEmailFromTemplate;
  validateAndRenderPush: typeof validateAndRenderPush;
  sendResendEmail: (
    input: SendResendEmailInput,
  ) => Promise<Awaited<ReturnType<typeof sendResendEmail>>>;
  sendFcmPush: (
    input: SendFcmPushInput,
  ) => Promise<Awaited<ReturnType<typeof sendFcmPush>>>;
  reportDeliveryOutcome: (
    supabase: SupabaseClient,
    input: ReportDeliveryOutcomeInput,
  ) => Promise<ReportDeliveryOutcomeResult>;
}

export function resolveEmailSender(): ProcessDispatchDeps["sendResendEmail"] {
  return Deno.env.get("INBUCKET_SMTP_HOST")
    ? sendInbucketEmail
    : sendResendEmail;
}

export const defaultProcessDispatchDeps: ProcessDispatchDeps = {
  fetchEmailTemplate,
  fetchPushTemplate,
  renderEmailFromTemplate,
  validateAndRenderPush,
  sendResendEmail: resolveEmailSender(),
  sendFcmPush,
  reportDeliveryOutcome,
};

async function processEmailDispatch(
  supabase: SupabaseClient,
  item: CheckoutDispatchDto,
  workerId: string,
  deps: ProcessDispatchDeps,
): Promise<DispatchProcessCounts> {
  const counts: DispatchProcessCounts = {
    renderFailed: 0,
    sendSucceeded: 0,
    sendFailed: 0,
  };

  try {
    const rendered = await withSpan(
      "render",
      "template",
      { channel: "email", dispatch_id: item.id, template_key: item.template_key },
      async () => {
        const template = await deps.fetchEmailTemplate(supabase, item.template_key);
        const variables = item.template_variables as Record<string, unknown>;
        return deps.renderEmailFromTemplate(template, variables);
      },
    );

    if (!item.recipient_email?.trim()) {
      counts.sendFailed += 1;
      log.warn("worker.email.send_skipped", {
        correlation_id: item.correlation_id,
        dispatch_id: item.id,
        code: "missing_recipient_email",
      });

      try {
        await deps.reportDeliveryOutcome(supabase, {
          dispatchId: item.id,
          workerId,
          channel: "email",
          success: false,
          errorCode: "missing_recipient_email",
          errorBody: "No recipient email in checkout payload",
          retryable: false,
        });
      } catch (reportErr) {
        log.error("worker.email.missing_email_report_failed", {
          dispatch_id: item.id,
          error: reportErr instanceof Error ? reportErr.message : String(reportErr),
        });
      }
      return counts;
    }

    const sendResult = await withSpan(
      "provider_http",
      "http.client",
      { channel: "email", dispatch_id: item.id, provider: "resend" },
      () =>
        deps.sendResendEmail({
          recipientEmail: item.recipient_email!,
          subject: rendered.subject,
          html: rendered.html,
          correlationId: item.correlation_id,
        }),
    );

    if (sendResult.ok) {
      const report = await withSpan(
        "report_outcome",
        "db.rpc",
        { channel: "email", dispatch_id: item.id, success: true },
        () =>
          deps.reportDeliveryOutcome(supabase, {
            dispatchId: item.id,
            workerId,
            channel: "email",
            success: true,
            vendorMessageId: sendResult.vendorMessageId,
            httpStatus: sendResult.httpStatus,
          }),
      );

      if (report.applied) {
        counts.sendSucceeded += 1;
        log.info("worker.email.sent", {
          correlation_id: item.correlation_id,
          dispatch_id: item.id,
          http_status: sendResult.httpStatus,
          vendor_message_id: sendResult.vendorMessageId,
        });
      } else {
        counts.sendFailed += 1;
        log.warn("worker.email.report_not_applied", {
          correlation_id: item.correlation_id,
          dispatch_id: item.id,
          reason: report.reason,
        });
      }
      return counts;
    }

    const classified = classifyProviderFailure(
      "email",
      sendResult.httpStatus,
      sendResult.errorCode,
    );
    const report = await withSpan(
      "report_outcome",
      "db.rpc",
      { channel: "email", dispatch_id: item.id, success: false },
      () =>
        deps.reportDeliveryOutcome(supabase, {
          dispatchId: item.id,
          workerId,
          channel: "email",
          success: false,
          httpStatus: sendResult.httpStatus,
          errorCode: classified.errorCode,
          errorBody: sendResult.errorMessage,
          retryable: classified.retryable,
        }),
    );
    counts.sendFailed += 1;
    log.warn("worker.email.send_failed", {
      correlation_id: item.correlation_id,
      dispatch_id: item.id,
      http_status: sendResult.httpStatus,
      error_code: sendResult.errorCode,
      error: sendResult.errorMessage,
      report_status: report.status,
    });
  } catch (err) {
    counts.renderFailed += 1;
    const code = err instanceof ResendConfigError || err instanceof InbucketConfigError
      ? err.code
      : failureCodeFromError(err);
    const message = err instanceof Error ? err.message : String(err);
    log.warn("worker.email.render_or_send_failed", {
      correlation_id: item.correlation_id,
      dispatch_id: item.id,
      code,
      error: message,
    });

    try {
      await deps.reportDeliveryOutcome(supabase, {
        dispatchId: item.id,
        workerId,
        channel: "email",
        success: false,
        errorCode: code,
        errorBody: message,
        retryable: false,
      });
    } catch (reportErr) {
      log.error("worker.email.render_failure_report_failed", {
        dispatch_id: item.id,
        error: reportErr instanceof Error ? reportErr.message : String(reportErr),
      });
    }
  }

  return counts;
}

async function processPushDispatch(
  supabase: SupabaseClient,
  item: CheckoutDispatchDto,
  workerId: string,
  deps: ProcessDispatchDeps,
): Promise<DispatchProcessCounts> {
  const counts: DispatchProcessCounts = {
    renderFailed: 0,
    sendSucceeded: 0,
    sendFailed: 0,
  };

  try {
    const rendered = await withSpan(
      "render",
      "template",
      { channel: "push", dispatch_id: item.id, template_key: item.template_key },
      async () => {
        const template = await deps.fetchPushTemplate(supabase, item.template_key);
        const variables = item.template_variables as Record<string, unknown>;
        return deps.validateAndRenderPush(template, variables);
      },
    );

    if (!item.deliveries.length) {
      counts.sendFailed += 1;
      log.warn("worker.push.send_skipped", {
        correlation_id: item.correlation_id,
        dispatch_id: item.id,
        code: "no_deliveries",
      });
      return counts;
    }

    const deliveryResults: PushDeliverySendResult[] = [];
    let lastVendorMessageId: string | null = null;
    let lastFailureStatus = 0;
    let lastFailureCode = "fcm_send_failed";
    let lastFailureMessage = "push delivery failed";

    for (const delivery of item.deliveries) {
      const fcmResult = await withSpan(
        "provider_http",
        "http.client",
        {
          channel: "push",
          dispatch_id: item.id,
          provider: "fcm",
          delivery_id: delivery.delivery_id,
        },
        () =>
          deps.sendFcmPush({
            fcmTokenSnapshot: delivery.fcm_token_snapshot,
            title: rendered.title,
            body: rendered.body,
            correlationId: item.correlation_id,
            deliveryId: delivery.delivery_id,
            dispatchId: item.id,
          }),
      );

      if (fcmResult.ok) {
        lastVendorMessageId = fcmResult.vendorMessageId;
        deliveryResults.push({
          delivery,
          ok: true,
          httpStatus: fcmResult.httpStatus,
        });
        log.info("worker.push.sent", {
          correlation_id: item.correlation_id,
          dispatch_id: item.id,
          delivery_id: delivery.delivery_id,
          device_id: delivery.device_id,
          http_status: fcmResult.httpStatus,
          vendor_message_id: fcmResult.vendorMessageId,
        });
      } else {
        lastFailureStatus = fcmResult.httpStatus;
        lastFailureCode = classifyProviderFailure(
          "push",
          fcmResult.httpStatus,
          fcmResult.errorCode,
        ).errorCode;
        lastFailureMessage = fcmResult.errorMessage;
        deliveryResults.push({
          delivery,
          ok: false,
          httpStatus: fcmResult.httpStatus,
          errorCode: fcmResult.errorCode,
        });
        log.warn("worker.push.send_failed", {
          correlation_id: item.correlation_id,
          dispatch_id: item.id,
          delivery_id: delivery.delivery_id,
          device_id: delivery.device_id,
          http_status: fcmResult.httpStatus,
          error_code: fcmResult.errorCode,
          error: fcmResult.errorMessage,
        });
      }
    }

    const deliveryReportPayload = buildPushDeliveryReportPayload(deliveryResults);
    const anySuccess = deliveryResults.some((r) => r.ok);

    if (anySuccess) {
      const report = await withSpan(
        "report_outcome",
        "db.rpc",
        { channel: "push", dispatch_id: item.id, success: true },
        () =>
          deps.reportDeliveryOutcome(supabase, {
            dispatchId: item.id,
            workerId,
            channel: "push",
            success: true,
            vendorMessageId: lastVendorMessageId,
            httpStatus: 200,
            deliveries: deliveryReportPayload,
          }),
      );

      if (report.applied) {
        counts.sendSucceeded += 1;
        const partialFailures = deliveryResults.filter((r) => !r.ok).length;
        if (partialFailures > 0) {
          log.info("worker.push.partial_delivered", {
            correlation_id: item.correlation_id,
            dispatch_id: item.id,
            partial_failures: partialFailures,
          });
        }
      } else {
        counts.sendFailed += 1;
        log.warn("worker.push.report_not_applied", {
          correlation_id: item.correlation_id,
          dispatch_id: item.id,
          reason: report.reason,
        });
      }
      return counts;
    }

    const classified = classifyProviderFailure(
      "push",
      lastFailureStatus,
      lastFailureCode,
    );
    const report = await withSpan(
      "report_outcome",
      "db.rpc",
      { channel: "push", dispatch_id: item.id, success: false },
      () =>
        deps.reportDeliveryOutcome(supabase, {
          dispatchId: item.id,
          workerId,
          channel: "push",
          success: false,
          httpStatus: lastFailureStatus,
          errorCode: classified.errorCode,
          errorBody: lastFailureMessage,
          retryable: classified.retryable,
          deliveries: deliveryReportPayload,
        }),
    );
    counts.sendFailed += 1;
    log.warn("worker.push.dispatch_failed", {
      correlation_id: item.correlation_id,
      dispatch_id: item.id,
      report_status: report.status,
    });
  } catch (err) {
    counts.renderFailed += 1;
    const code = err instanceof FcmConfigError
      ? err.code
      : failureCodeFromError(err);
    const message = err instanceof Error ? err.message : String(err);
    log.warn("worker.push.render_or_send_failed", {
      correlation_id: item.correlation_id,
      dispatch_id: item.id,
      code,
      error: message,
    });

    try {
      await deps.reportDeliveryOutcome(supabase, {
        dispatchId: item.id,
        workerId,
        channel: "push",
        success: false,
        errorCode: code,
        errorBody: message,
        retryable: false,
      });
    } catch (reportErr) {
      log.error("worker.push.render_failure_report_failed", {
        dispatch_id: item.id,
        error: reportErr instanceof Error ? reportErr.message : String(reportErr),
      });
    }
  }

  return counts;
}

export async function processDispatchItem(
  supabase: SupabaseClient,
  item: CheckoutDispatchDto,
  workerId: string,
  deps: ProcessDispatchDeps = defaultProcessDispatchDeps,
): Promise<DispatchProcessCounts> {
  if (item.channel === "email") {
    return processEmailDispatch(supabase, item, workerId, deps);
  }
  if (item.channel === "push") {
    return processPushDispatch(supabase, item, workerId, deps);
  }

  return { renderFailed: 0, sendSucceeded: 0, sendFailed: 0 };
}

/** Processes checkout items sequentially; never parallelizes report RPCs (design §5.5). */
export async function processCheckoutItemsSequential(
  supabase: SupabaseClient,
  items: CheckoutDispatchDto[],
  workerId: string,
  deps: ProcessDispatchDeps = defaultProcessDispatchDeps,
  budget: WorkerWallClockBudget = createWorkerWallClockBudget(),
): Promise<WorkerRunResult> {
  let renderFailed = 0;
  let sendSucceeded = 0;
  let sendFailed = 0;
  let attempted = 0;
  let skipped = 0;

  for (const item of items) {
    if (isWorkerWallClockExceeded(budget)) {
      skipped = items.length - attempted;
      log.warn("worker.batch_budget_exceeded", {
        worker_id: workerId,
        attempted,
        skipped,
        wall_clock_ms: Math.round(workerWallClockElapsedMs(budget)),
        budget_ms: budget.budgetMs,
      });
      break;
    }

    const counts = await processDispatchItem(supabase, item, workerId, deps);
    attempted += 1;
    renderFailed += counts.renderFailed;
    sendSucceeded += counts.sendSucceeded;
    sendFailed += counts.sendFailed;
  }

  const wallClockMs = Math.round(workerWallClockElapsedMs(budget));

  return {
    processed: attempted,
    succeeded: sendSucceeded,
    failed: renderFailed + sendFailed,
    skipped,
    wall_clock_ms: wallClockMs,
    budget_exceeded: skipped > 0,
  };
}

export { WORKER_WALL_CLOCK_BUDGET_MS };
