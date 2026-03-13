import { useCallback } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "@/features/auth";
import {
  validatePasswordStrength,
  clientSignupIdentitySchema,
  identityToFullName,
  getClientEmailRedirectTo,
} from "@/features/auth";
import { useAnalytics } from "@/hooks/useAnalytics";
import { logger } from "@/lib/logger";
import { metrics, addBreadcrumb, Sentry } from "@/lib/sentry";
import { createRequestQuoteOrder } from "../api/createRequestQuoteOrder.api";
import { clearDraft } from "../utils/requestQuoteDraft.persistence";
import { checkPhotosContent } from "../utils/photoContentCheck";
import type { RequestQuoteState } from "./useRequestQuoteState";

export interface UseRequestQuoteSubmitParams {
  state: RequestQuoteState;
}

export interface UseRequestQuoteSubmitResult {
  handleSubmit: () => Promise<void>;
  handleSubmitLoggedIn: () => Promise<void>;
}

export function useRequestQuoteSubmit({
  state,
}: UseRequestQuoteSubmitParams): UseRequestQuoteSubmitResult {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { user, session, signUp } = useAuth();

  const handleSubmitLoggedIn = useCallback(async () => {
    if (!user || !state.selectedService || !state.step4Data) return;
    state.setLoading(true);
    try {
      const selectedService = state.selectedService;
      await Sentry.startSpan(
        { name: "request_quote.submit", op: "function" },
        async (span) => {
          span?.setAttribute("request_quote.source", "logged_in");
          if (state.step3Data.photos.length > 0) {
            const check = await checkPhotosContent(state.step3Data.photos);
            if (!check.allowed) {
              logger.warn("request_quote_photo_content_rejected", {
                userId: user.id,
                photoCount: state.step3Data.photos.length,
              });
              trackEvent("quote_request_failed", { reason: "validation" });
              toast.error(check.error);
              state.setLoading(false);
              return;
            }
          }
          const result = await createRequestQuoteOrder({
            userId: user.id,
            email: user.email ?? "",
            step4Data: state.step4Data,
            step3Data: state.step3Data,
            selectedService,
            step2Data: state.step2Data,
            step2FormSchema: state.step2FormSchema,
            step2FormVersion: state.step2FormVersion,
            session,
          });
          if (result.success) {
            addBreadcrumb({
              message: "request_quote.order_created",
              data: { is_logged_in: true, service_id: selectedService.id },
            });
            metrics.count("request_quote.order_created", 1, { source: "logged_in" });
            trackEvent("quote_request_completed", {
              is_logged_in: true,
              service_id: selectedService.id,
              service_slug: selectedService.slug,
              source: "logged_in",
              had_photos: state.step3Data.photos.length > 0,
            });
            clearDraft();
            toast.success("Pedido enviado com sucesso!");
            await new Promise((r) => setTimeout(r, 800));
            navigate("/dashboard/client", { replace: true });
          } else {
            logger.warn("request_quote_submit_failed", {
              reason: result.retryAfter != null ? "rate_limit" : "api",
              error: result.error,
              userId: user.id,
            });
            addBreadcrumb({
              message: "request_quote.order_failed",
              level: "warning",
              data: { reason: result.retryAfter != null ? "rate_limit" : "api" },
            });
            trackEvent("quote_request_failed", {
              reason: result.retryAfter != null ? "rate_limit" : "api",
            });
            toast.error(result.retryAfter != null ? `Tente novamente em ${result.retryAfter} segundos.` : result.error);
          }
        }
      );
    } catch (err) {
      logger.error("request_quote_submit_exception", {
        error: err instanceof Error ? err.message : String(err),
        isLoggedIn: true,
        userId: user.id,
      });
      addBreadcrumb({ message: "request_quote.order_failed", level: "error", data: { reason: "exception" } });
      trackEvent("quote_request_failed", { reason: "api" });
      toast.error("Ocorreu um erro. Tente novamente.");
    } finally {
      state.setLoading(false);
    }
  }, [user, session, state, navigate, trackEvent]);

  const handleSubmit = useCallback(async () => {
    if (user) {
      await handleSubmitLoggedIn();
      return;
    }
    const identityResult = clientSignupIdentitySchema.safeParse(state.step5Data);
    if (!identityResult.success) {
      logger.warn("request_quote_guest_validation_failed", {
        reason: "identity",
        message: identityResult.error.issues[0].message,
      });
      trackEvent("quote_request_failed", { reason: "validation" });
      toast.error(identityResult.error.issues[0].message);
      return;
    }
    const passwordValidation = validatePasswordStrength(state.step5Data.password);
    if (!passwordValidation.valid) {
      logger.warn("request_quote_guest_validation_failed", {
        reason: "password",
      });
      trackEvent("quote_request_failed", { reason: "validation" });
      toast.error(passwordValidation.errors[0]);
      return;
    }
    const fullName = identityToFullName(state.step5Data);
    const email = state.step5Data.email.toLowerCase().trim();
    state.setLoading(true);
    try {
      await Sentry.startSpan(
        { name: "request_quote.submit", op: "function" },
        async (span) => {
          span?.setAttribute("request_quote.source", "guest_signup");
          const signUpResult = await signUp(
            email,
            state.step5Data.password,
            fullName,
            "client",
            { emailRedirectTo: getClientEmailRedirectTo() }
          );
          if (!signUpResult.success) {
            logger.warn("request_quote_guest_signup_failed", {
              reason: signUpResult.reason,
              serviceId: state.selectedService?.id,
            });
            if (signUpResult.reason === "already_registered") {
              trackEvent("quote_request_guest_already_registered", {
                service_slug: state.selectedService?.slug ?? undefined,
              });
              navigate("/login", { state: { email: state.step5Data.email } });
            }
            state.setLoading(false);
            return;
          }
          const userId = signUpResult.userId!;

          if (state.step3Data.photos.length > 0) {
            const check = await checkPhotosContent(state.step3Data.photos);
            if (!check.allowed) {
              logger.warn("request_quote_photo_content_rejected", {
                userId,
                photoCount: state.step3Data.photos.length,
              });
              trackEvent("quote_request_failed", { reason: "validation" });
              toast.error(check.error);
              state.setLoading(false);
              return;
            }
          }

          const result = await createRequestQuoteOrder({
            userId,
            email,
            step4Data: state.step4Data!,
            step3Data: state.step3Data,
            selectedService: state.selectedService!,
            step2Data: state.step2Data,
            step2FormSchema: state.step2FormSchema,
            step2FormVersion: state.step2FormVersion,
            session: null,
          });

          if (result.success) {
            addBreadcrumb({
              message: "request_quote.order_created",
              data: { is_logged_in: false, service_id: state.selectedService!.id },
            });
            metrics.count("request_quote.order_created", 1, { source: "guest_signup" });
            trackEvent("quote_request_completed", {
              is_logged_in: false,
              service_id: state.selectedService!.id,
              service_slug: state.selectedService!.slug,
              source: "guest_signup",
              had_photos: state.step3Data.photos.length > 0,
            });
            clearDraft();
            state.setOrderCreatedEmail(email);
          } else {
            logger.warn("request_quote_submit_failed", {
              reason: result.retryAfter != null ? "rate_limit" : "api",
              error: result.error,
              userId,
            });
            addBreadcrumb({
              message: "request_quote.order_failed",
              level: "warning",
              data: { reason: result.retryAfter != null ? "rate_limit" : "api" },
            });
            trackEvent("quote_request_failed", {
              reason: result.retryAfter != null ? "rate_limit" : "api",
            });
            toast.error(result.retryAfter != null ? `Tente novamente em ${result.retryAfter} segundos.` : result.error);
          }
        }
      );
    } catch (err) {
      logger.error("request_quote_submit_exception", {
        error: err instanceof Error ? err.message : String(err),
        isLoggedIn: false,
      });
      addBreadcrumb({ message: "request_quote.order_failed", level: "error", data: { reason: "exception" } });
      trackEvent("quote_request_failed", { reason: "api" });
      toast.error("Ocorreu um erro. Tente novamente.");
    } finally {
      state.setLoading(false);
    }
  }, [user, state, signUp, navigate, handleSubmitLoggedIn, trackEvent]);

  return { handleSubmit, handleSubmitLoggedIn };
}
