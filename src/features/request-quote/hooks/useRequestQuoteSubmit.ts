import { useCallback } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "@/features/auth";
import {
  validatePasswordStrength,
  clientSignupIdentitySchema,
  identityToFullName,
} from "@/features/auth";
import { createServiceRequest } from "../api/serviceRequests.api";
import {
  resolveAddressForSubmit,
  uploadPhotosForSubmit,
  buildServiceRequestParams,
} from "../utils/requestQuoteSubmit.utils";
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
  const { user, signUp } = useAuth();

  const handleSubmitLoggedIn = useCallback(async () => {
    if (!user || !state.selectedService) return;
    state.setLoading(true);
    try {
      const addressResult = await resolveAddressForSubmit(user.id, state.step4Data, {
        defaultLabel: "Casa",
        isDefault: false,
      });
      if (!addressResult.ok) {
        toast.error(addressResult.error);
        state.setLoading(false);
        return;
      }
      const photoUrls = await uploadPhotosForSubmit(user.id, state.step3Data.photos);
      const { error: reqErr } = await createServiceRequest(
        buildServiceRequestParams({
          client_id: user.id,
          service_id: state.selectedService.id,
          service_title: state.selectedService.title,
          address_id: addressResult.addressId,
          city: addressResult.city,
          neighborhood: addressResult.neighborhood,
          description: state.step3Data.description,
          photoUrls,
          form_data: state.step2Data,
          form_schema: state.step2FormSchema,
          form_version: state.step2FormVersion,
        })
      );
      if (reqErr) {
        toast.error("Erro ao criar o pedido. Tente novamente.");
        state.setLoading(false);
        return;
      }
      toast.success("Pedido enviado com sucesso!");
      await new Promise((r) => setTimeout(r, 800));
      navigate("/dashboard/client", { replace: true });
    } catch {
      toast.error("Erro ao processar. Tente novamente.");
    } finally {
      state.setLoading(false);
    }
  }, [user, state, navigate]);

  const handleSubmit = useCallback(async () => {
    if (user) {
      await handleSubmitLoggedIn();
      return;
    }
    const identityResult = clientSignupIdentitySchema.safeParse(state.step5Data);
    if (!identityResult.success) {
      toast.error(identityResult.error.issues[0].message);
      return;
    }
    const passwordValidation = validatePasswordStrength(state.step5Data.password);
    if (!passwordValidation.valid) {
      toast.error(passwordValidation.errors[0]);
      return;
    }
    const fullName = identityToFullName(state.step5Data);
    state.setLoading(true);
    try {
      const result = await signUp(
        state.step5Data.email.toLowerCase().trim(),
        state.step5Data.password,
        fullName,
        "client",
        { emailRedirectTo: `${window.location.origin}/dashboard/client` }
      );
      if (!result.success) {
        if (result.reason === "already_registered") {
          navigate("/login", { state: { email: state.step5Data.email } });
        }
        state.setLoading(false);
        return;
      }
      const userId = result.userId!;

      const addressResult = await resolveAddressForSubmit(userId, state.step4Data!, {
        defaultLabel: "Endereço desconhecido",
        isDefault: true,
      });
      if (!addressResult.ok) {
        toast.error(addressResult.error);
        state.setLoading(false);
        return;
      }
      const photoUrls = await uploadPhotosForSubmit(userId, state.step3Data.photos, () =>
        toast("Algumas fotos não foram enviadas.")
      );
      const { error: requestError } = await createServiceRequest(
        buildServiceRequestParams({
          client_id: userId,
          service_id: state.selectedService!.id,
          service_title: state.selectedService?.title ?? "serviço",
          address_id: addressResult.addressId,
          city: addressResult.city,
          neighborhood: addressResult.neighborhood,
          description: state.step3Data.description,
          photoUrls,
          form_data: state.step2Data,
          form_schema: state.step2FormSchema,
          form_version: state.step2FormVersion,
        })
      );
      if (requestError) {
        if (
          requestError.includes("row-level security") ||
          requestError.includes("RLS")
        ) {
          toast.error("Erro de permissão. Faça login e tente novamente.");
          navigate("/login", { state: { email: state.step5Data.email } });
        } else {
          toast.error("Erro ao criar o pedido. Entre em contato com o suporte.");
        }
        state.setLoading(false);
        return;
      }
      toast.success("Sua conta foi criada e o pedido foi enviado com sucesso!");
      await new Promise((r) => setTimeout(r, 800));
      navigate("/dashboard/client", { replace: true });
    } catch {
      toast.error("Erro ao processar sua solicitação. Tente novamente.");
    } finally {
      state.setLoading(false);
    }
  }, [user, state, signUp, navigate, handleSubmitLoggedIn]);

  return { handleSubmit, handleSubmitLoggedIn };
}
