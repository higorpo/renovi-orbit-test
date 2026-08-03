import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useAnalytics } from "@/hooks/useAnalytics";
import { addBreadcrumb } from "@/lib/sentry";
import { maskCNPJ, maskCPF, maskPhone } from "@/lib/masks";
import {
  fetchProviderPrivateProfileForKyc,
  uploadKycDocument,
} from "../api/kyc.api";
import { useDispatchKyc } from "./useDispatchKyc";
import {
  bankStepSchema,
  documentsStepCnpjSchema,
  documentsStepCpfSchema,
  entityStepSchema,
  identityStepCnpjSchema,
  identityStepCpfSchema,
  KYC_WIZARD_STEPS,
  providerKycCnpjSchema,
  providerKycCpfSchema,
  type KycEntityType,
  type KycWizardStep,
  type ProviderKycCnpjFormData,
  type ProviderKycCpfFormData,
} from "../types/providerKyc.validation";

export type ProviderKycWizardFormValues = {
  entityType: KycEntityType;
  fullName: string;
  document: string;
  phone: string;
  email: string;
  bankInstitutionCode: string;
  bankBranch: string;
  bankAccount: string;
  pixKey: string;
  razaoSocial: string;
  nomeFantasia: string;
  legalRepFullName: string;
  legalRepCpf: string;
  legalRepPhone: string;
  identityDoc: File | null;
  addressProofDoc: File | null;
  corporateCharterDoc: File | null;
  legalRepDoc: File | null;
};

export type UseProviderKycWizardParams = {
  providerId: string;
  accountEmail: string;
  defaultPhone?: string;
  defaultFullName?: string;
  onSubmitted?: () => void;
};

const STEP_LABELS: Record<KycWizardStep, string> = {
  entity: "Tipo de cadastro",
  identity: "Dados pessoais",
  bank: "Dados bancários",
  documents: "Documentos",
  review: "Revisão",
};

function buildDefaultValues(
  accountEmail: string,
  defaultPhone?: string,
  defaultFullName?: string,
): ProviderKycWizardFormValues {
  return {
    entityType: "CPF",
    fullName: defaultFullName ?? "",
    document: "",
    phone: defaultPhone ?? "",
    email: accountEmail,
    bankInstitutionCode: "",
    bankBranch: "",
    bankAccount: "",
    pixKey: "",
    razaoSocial: "",
    nomeFantasia: "",
    legalRepFullName: "",
    legalRepCpf: "",
    legalRepPhone: "",
    identityDoc: null,
    addressProofDoc: null,
    corporateCharterDoc: null,
    legalRepDoc: null,
  };
}

function firstIssueMessage(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Verifique os campos deste passo";
}

function applyStepIssuesToForm(
  form: ReturnType<typeof useForm<ProviderKycWizardFormValues>>,
  issues: { path: (string | number)[]; message: string }[],
): boolean {
  let appliedToField = false;
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;
    form.setError(field as keyof ProviderKycWizardFormValues, {
      message: issue.message,
    });
    appliedToField = true;
  }
  return appliedToField;
}

export function useProviderKycWizard({
  providerId,
  accountEmail,
  defaultPhone,
  defaultFullName,
  onSubmitted,
}: UseProviderKycWizardParams) {
  const { trackEvent } = useAnalytics();
  const dispatchKyc = useDispatchKyc();
  const [stepIndex, setStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isPrefilling, setIsPrefilling] = useState(true);

  const form = useForm<ProviderKycWizardFormValues>({
    defaultValues: buildDefaultValues(accountEmail, defaultPhone, defaultFullName),
    mode: "onSubmit",
    shouldUnregister: false,
  });

  // Manual setError persists until cleared — drop field errors as values update.
  useEffect(() => {
    const subscription = form.watch((_values, info) => {
      if (!info.name) return;
      form.clearErrors(info.name);
      setStepError(null);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const step = KYC_WIZARD_STEPS[stepIndex]!;
  const totalSteps = KYC_WIZARD_STEPS.length;
  const entityType = form.watch("entityType");
  const isCnpj = entityType === "CNPJ";
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;
  const isSubmitting = dispatchKyc.isPending;

  const analyticsEntityType = entityType === "CNPJ" ? "pj" : "pf";

  useEffect(() => {
    trackEvent("provider_kyc_step_viewed", {
      step,
      entity_type: analyticsEntityType,
    });
    addBreadcrumb({
      message: "provider_kyc.step_viewed",
      category: "provider_kyc",
      data: { step, entity_type: analyticsEntityType },
    });
  }, [analyticsEntityType, step, trackEvent]);

  useEffect(() => {
    let cancelled = false;

    async function prefill() {
      setIsPrefilling(true);
      const { data } = await fetchProviderPrivateProfileForKyc(providerId);
      if (cancelled) {
        return;
      }
      if (!data) {
        setIsPrefilling(false);
        return;
      }

      const nextEntity = data.entityType ?? "CPF";
      const rawDocument = data.document ?? "";
      const maskedDocument = nextEntity === "CNPJ"
        ? maskCNPJ(rawDocument)
        : maskCPF(rawDocument);

      form.reset({
        ...buildDefaultValues(accountEmail, defaultPhone, defaultFullName),
        entityType: nextEntity,
        document: maskedDocument,
        phone: defaultPhone ? maskPhone(defaultPhone) : "",
        bankInstitutionCode: data.bankInstitutionCode ?? "",
        bankBranch: data.bankBranch ?? "",
        bankAccount: data.bankAccount ?? "",
        pixKey: data.pixKey ?? "",
        razaoSocial: data.razaoSocial ?? "",
        nomeFantasia: data.nomeFantasia ?? "",
        legalRepFullName: data.legalRepFullName ?? "",
        legalRepCpf: data.legalRepCpf ? maskCPF(data.legalRepCpf) : "",
        legalRepPhone: data.legalRepPhone ? maskPhone(data.legalRepPhone) : "",
        fullName: defaultFullName ?? "",
        email: accountEmail,
      });
      setIsPrefilling(false);
    }

    void prefill();
    return () => {
      cancelled = true;
    };
    // form.reset is stable; omit `form` to avoid re-running prefill on field edits
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [accountEmail, defaultFullName, defaultPhone, providerId]);

  const validateCurrentStep = useCallback((): boolean => {
    setStepError(null);
    form.clearErrors();
    const values = form.getValues();

    if (step === "entity") {
      const parsed = entityStepSchema.safeParse({ entityType: values.entityType });
      if (!parsed.success) {
        if (!applyStepIssuesToForm(form, parsed.error.issues)) {
          setStepError(firstIssueMessage(parsed.error.issues));
        }
        return false;
      }
      return true;
    }

    if (step === "identity") {
      const parsed = values.entityType === "CPF"
        ? identityStepCpfSchema.safeParse(values)
        : identityStepCnpjSchema.safeParse(values);
      if (!parsed.success) {
        if (!applyStepIssuesToForm(form, parsed.error.issues)) {
          setStepError(firstIssueMessage(parsed.error.issues));
        }
        return false;
      }
      return true;
    }

    if (step === "bank") {
      const parsed = bankStepSchema.safeParse(values);
      if (!parsed.success) {
        if (!applyStepIssuesToForm(form, parsed.error.issues)) {
          setStepError(firstIssueMessage(parsed.error.issues));
        }
        return false;
      }
      return true;
    }

    if (step === "documents") {
      const parsed = values.entityType === "CPF"
        ? documentsStepCpfSchema.safeParse(values)
        : documentsStepCnpjSchema.safeParse(values);
      if (!parsed.success) {
        if (!applyStepIssuesToForm(form, parsed.error.issues)) {
          setStepError(firstIssueMessage(parsed.error.issues));
        }
        return false;
      }
      return true;
    }

    return true;
  }, [form, step]);

  const goNext = useCallback(() => {
    if (!validateCurrentStep()) return;
    if (isLastStep) return;
    form.clearErrors();
    setStepIndex((current) => Math.min(current + 1, totalSteps - 1));
  }, [form, isLastStep, totalSteps, validateCurrentStep]);

  const goBack = useCallback(() => {
    setStepError(null);
    setSubmitError(null);
    form.clearErrors();
    setStepIndex((current) => Math.max(current - 1, 0));
  }, [form]);

  const submit = useCallback(async () => {
    setSubmitError(null);
    setStepError(null);
    form.clearErrors();

    const values = form.getValues();
    const parsed = values.entityType === "CPF"
      ? providerKycCpfSchema.safeParse(values)
      : providerKycCnpjSchema.safeParse(values);

    if (!parsed.success) {
      if (!applyStepIssuesToForm(form, parsed.error.issues)) {
        setStepError(firstIssueMessage(parsed.error.issues));
      }
      return;
    }

    const data = parsed.data as ProviderKycCpfFormData | ProviderKycCnpjFormData;

    addBreadcrumb({
      message: "provider_kyc.submit_started",
      category: "provider_kyc",
      data: { entity_type: analyticsEntityType },
    });

    try {
      if (data.entityType === "CPF") {
        const [identity, addressProof] = await Promise.all([
          uploadKycDocument(providerId, "identity", data.identityDoc),
          uploadKycDocument(providerId, "address-proof", data.addressProofDoc),
        ]);

        const failedUpload = [identity, addressProof].find(
          (upload) => upload.error || !upload.signedUrl || !upload.path,
        );
        if (failedUpload) {
          throw new Error(failedUpload.error ?? "Falha ao enviar documentos");
        }

        await dispatchKyc.mutateAsync({
          entityType: data.entityType,
          fullName: data.fullName,
          document: data.document,
          phone: data.phone,
          email: data.email,
          bankInstitutionCode: data.bankInstitutionCode,
          bankBranch: data.bankBranch,
          bankAccount: data.bankAccount,
          pixKey: data.pixKey,
          identityDocStoragePath: identity.path!,
          addressProofStoragePath: addressProof.path!,
          identityDocUrl: identity.signedUrl!,
          addressProofUrl: addressProof.signedUrl!,
        });
      } else {
        // PJ: legal-rep ID is the identity document (dual-mapped to identity + legal_rep columns).
        const [legalRepDoc, addressProof, corporateCharter] = await Promise.all([
          uploadKycDocument(providerId, "legal-rep-id", data.legalRepDoc),
          uploadKycDocument(providerId, "address-proof", data.addressProofDoc),
          uploadKycDocument(providerId, "corporate-charter", data.corporateCharterDoc),
        ]);

        const failedUpload = [legalRepDoc, addressProof, corporateCharter].find(
          (upload) => upload.error || !upload.signedUrl || !upload.path,
        );
        if (failedUpload) {
          throw new Error(failedUpload.error ?? "Falha ao enviar documentos");
        }

        await dispatchKyc.mutateAsync({
          entityType: data.entityType,
          fullName: data.fullName,
          document: data.document,
          phone: data.phone,
          email: data.email,
          bankInstitutionCode: data.bankInstitutionCode,
          bankBranch: data.bankBranch,
          bankAccount: data.bankAccount,
          pixKey: data.pixKey,
          identityDocStoragePath: legalRepDoc.path!,
          addressProofStoragePath: addressProof.path!,
          identityDocUrl: legalRepDoc.signedUrl!,
          addressProofUrl: addressProof.signedUrl!,
          razaoSocial: data.razaoSocial,
          nomeFantasia: data.nomeFantasia,
          legalRepFullName: data.legalRepFullName,
          legalRepCpf: data.legalRepCpf,
          legalRepPhone: data.legalRepPhone,
          corporateCharterStoragePath: corporateCharter.path!,
          legalRepDocStoragePath: legalRepDoc.path!,
          corporateCharterUrl: corporateCharter.signedUrl!,
          legalRepDocUrl: legalRepDoc.signedUrl!,
        });
      }

      trackEvent("provider_kyc_submitted", {
        step: "review",
        entity_type: analyticsEntityType,
      });
      addBreadcrumb({
        message: "provider_kyc.submit_succeeded",
        category: "provider_kyc",
        data: { entity_type: analyticsEntityType },
      });
      onSubmitted?.();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Falha ao enviar credenciamento";
      setSubmitError(message);
      trackEvent("provider_kyc_submit_failed", {
        step: "review",
        entity_type: analyticsEntityType,
      });
      addBreadcrumb({
        message: "provider_kyc.submit_failed",
        category: "provider_kyc",
        level: "error",
        data: { entity_type: analyticsEntityType, error: message },
      });
    }
  }, [
    analyticsEntityType,
    dispatchKyc,
    form,
    onSubmitted,
    providerId,
    trackEvent,
  ]);

  const progressLabel = useMemo(
    () => `Passo ${stepIndex + 1} de ${totalSteps}`,
    [stepIndex, totalSteps],
  );

  return {
    form,
    step,
    stepIndex,
    totalSteps,
    stepLabel: STEP_LABELS[step],
    progressLabel,
    isCnpj,
    isFirstStep,
    isLastStep,
    isSubmitting,
    isPrefilling,
    stepError,
    submitError,
    goNext,
    goBack,
    submit,
  };
}
