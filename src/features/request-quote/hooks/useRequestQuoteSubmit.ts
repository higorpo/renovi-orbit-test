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
import { createRequestQuoteOrder } from "../api/createRequestQuoteOrder.api";
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
      if (state.step3Data.photos.length > 0) {
        const check = await checkPhotosContent(state.step3Data.photos);
        if (!check.allowed) {
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
        selectedService: state.selectedService,
        step2Data: state.step2Data,
        step2FormSchema: state.step2FormSchema,
        step2FormVersion: state.step2FormVersion,
        session,
      });
      if (result.success) {
        trackEvent("quote_request_completed", {
          is_logged_in: true,
          service_id: state.selectedService.id,
          service_slug: state.selectedService.slug,
          source: "logged_in",
          had_photos: state.step3Data.photos.length > 0,
        });
        toast.success("Pedido enviado com sucesso!");
        await new Promise((r) => setTimeout(r, 800));
        navigate("/dashboard/client", { replace: true });
      } else {
        trackEvent("quote_request_failed", {
          reason: result.retryAfter != null ? "rate_limit" : "api",
        });
        toast.error(result.retryAfter != null ? `Tente novamente em ${result.retryAfter} segundos.` : result.error);
      }
    } catch {
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
      trackEvent("quote_request_failed", { reason: "validation" });
      toast.error(identityResult.error.issues[0].message);
      return;
    }
    const passwordValidation = validatePasswordStrength(state.step5Data.password);
    if (!passwordValidation.valid) {
      trackEvent("quote_request_failed", { reason: "validation" });
      toast.error(passwordValidation.errors[0]);
      return;
    }
    const fullName = identityToFullName(state.step5Data);
    const email = state.step5Data.email.toLowerCase().trim();
    state.setLoading(true);
    try {
      const signUpResult = await signUp(
        email,
        state.step5Data.password,
        fullName,
        "client",
        { emailRedirectTo: getClientEmailRedirectTo() }
      );
      if (!signUpResult.success) {
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
        trackEvent("quote_request_completed", {
          is_logged_in: false,
          service_id: state.selectedService!.id,
          service_slug: state.selectedService!.slug,
          source: "guest_signup",
          had_photos: state.step3Data.photos.length > 0,
        });
        state.setOrderCreatedEmail(email);
      } else {
        trackEvent("quote_request_failed", {
          reason: result.retryAfter != null ? "rate_limit" : "api",
        });
        toast.error(result.retryAfter != null ? `Tente novamente em ${result.retryAfter} segundos.` : result.error);
      }
    } catch {
      trackEvent("quote_request_failed", { reason: "api" });
      toast.error("Ocorreu um erro. Tente novamente.");
    } finally {
      state.setLoading(false);
    }
  }, [user, state, signUp, navigate, handleSubmitLoggedIn, trackEvent]);

  return { handleSubmit, handleSubmitLoggedIn };
}
