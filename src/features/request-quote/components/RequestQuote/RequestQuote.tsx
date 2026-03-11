import { useSearchParams, Link, useNavigate } from "react-router";
import { useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Loader2, Check, X, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import { clientSignupIdentitySchema } from "@/features/auth";
import { useRequestQuoteState } from "../../hooks/useRequestQuoteState";
import { useRequestQuoteSubmit } from "../../hooks/useRequestQuoteSubmit";
import { useRequestQuoteNavigation } from "../../hooks/useRequestQuoteNavigation";
import { Step1ServiceSelect } from "./Step1ServiceSelect";
import { Step2ServiceForm } from "./Step2ServiceForm";
import { Step3DescriptionPhotos } from "./Step3DescriptionPhotos";
import { AddressSelectionStep, addressFormSchema } from "@/features/addresses";
import { Step5Identity } from "./Step5Identity";
import { TrustSidebar } from "../TrustSidebar";
import { getServiceCardStyle } from "../../utils/serviceCardStyle";
import { ConfirmEmailScreen } from "../ConfirmEmailScreen/ConfirmEmailScreen";

export function RequestQuote() {
  const [searchParams] = useSearchParams();
  const { user, loadingSession } = useAuth();
  const urlServiceSlug = searchParams.get("serviceSlug");

  const state = useRequestQuoteState();
  const { handleSubmit, handleSubmitLoggedIn } = useRequestQuoteSubmit({ state });
  const {
    handleNext,
    handleBack,
    handleServiceSelect,
    totalSteps,
  } = useRequestQuoteNavigation({
    state,
    user: user ?? null,
    onSubmitLoggedIn: handleSubmitLoggedIn,
  });

  const prevStepRef = useRef(state.currentStep);
  const { currentStep, setPreviousStep } = state;
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      setPreviousStep(prevStepRef.current);
      prevStepRef.current = currentStep;
    }
  }, [currentStep, setPreviousStep]);

  /** Persists across step navigation so we don't re-call the API when returning to step 3 without editing step 2. */
  const step2DataSnapshotRef = useRef<string | null>(null);

  const steps = [
    () => (
      <Step1ServiceSelect
        urlServiceSlug={urlServiceSlug}
        loadingSession={loadingSession}
        selectedService={state.selectedService}
        setSelectedService={state.setSelectedService}
        onServiceSelect={handleServiceSelect}
      />
    ),
    () => (
      <Step2ServiceForm
        serviceSlug={state.selectedService?.slug ?? null}
        serviceId={state.selectedService?.id ?? null}
        data={state.step2Data}
        onDataChange={state.setStep2Data}
        onComplete={(data, schema) => {
          state.setStep2Data(data);
          state.setStep2FormSchema(schema as Record<string, unknown> | null);
          state.setStep2FormVersion(schema?.version ?? null);
          state.setCurrentStep(3);
        }}
        onBack={() => state.setCurrentStep(1)}
      />
    ),
    () => (
      <Step3DescriptionPhotos state={state} step2DataSnapshotRef={step2DataSnapshotRef} />
    ),
    () => (
      <AddressSelectionStep
        userId={user?.id ?? null}
        onSelectionChange={state.setStep4Data}
        step4Data={state.step4Data}
        title="Endereço do serviço"
        choosePrompt="Escolha um endereço ou cadastre um novo."
        newAddressLabel="Cadastrar novo endereço"
        backToAddressesLabel="Voltar para meus endereços"
      />
    ),
    () => (
      <Step5Identity
        data={state.step5Data}
        onDataChange={state.setStep5Data}
      />
    ),
  ];

  const stepsToShow = user ? steps.slice(0, 4) : steps;
  const currentRender = stepsToShow[state.currentStep - 1];
  const showConfirmEmail = state.orderCreatedEmail != null;

  const stepLabels = totalSteps === 5
    ? [
        { step: 1, label: "Serviço", time: "30s" },
        { step: 2, label: "Detalhes", time: "3min" },
        { step: 3, label: "Descrição", time: "2min" },
        { step: 4, label: "Endereço", time: "1min" },
        { step: 5, label: "Cadastro", time: "2min" },
      ]
    : [
        { step: 1, label: "Serviço", time: "30s" },
        { step: 2, label: "Detalhes", time: "3min" },
        { step: 3, label: "Descrição", time: "2min" },
        { step: 4, label: "Endereço", time: "1min" },
      ];

  const navigate = useNavigate();

  const isAddressStepValid = useMemo(() => {
    if (state.currentStep !== 4) return true;
    const data = state.step4Data;
    if (!data) return false;
    if (data.kind === "existing") return true;
    return addressFormSchema.safeParse(data.formData).success;
  }, [state.currentStep, state.step4Data]);

  const isDescriptionStepValid = useMemo(
    () => state.currentStep !== 3 || state.step3Data.description.trim().length > 0,
    [state.currentStep, state.step3Data.description]
  );

  const isStep5Valid = useMemo(
    () => clientSignupIdentitySchema.safeParse(state.step5Data).success,
    [state.step5Data]
  );

  const isFinalStepValid =
    (state.currentStep === 4 && isAddressStepValid) ||
    (state.currentStep === 5 && isStep5Valid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary to-primary/90 overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <Link to="/">
            <img src="/logo-renovi-white.webp" alt="Renovi" className="h-7 sm:h-8 md:h-10 w-auto" />
          </Link>

          <div className="hidden sm:flex items-center gap-1 md:gap-2">
            {!showConfirmEmail && stepLabels.map((item, index) => (
              <div key={item.step} className="flex items-center">
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all ${
                    state.currentStep >= item.step
                      ? "bg-accent text-white shadow-lg"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      state.currentStep > item.step ? "bg-white/20" : ""
                    }`}
                  >
                    {state.currentStep > item.step ? <Check className="w-3 h-3" /> : item.step}
                  </div>
                  <span className="hidden lg:inline text-xs font-medium">{item.label}</span>
                  {state.currentStep === item.step && (
                    <span className="hidden lg:inline text-[10px] text-white/70 ml-0.5">
                      ~{item.time}
                    </span>
                  )}
                </div>
                {index < stepLabels.length - 1 && (
                  <div
                    className={`w-4 lg:w-8 h-0.5 mx-0.5 transition-all ${
                      state.currentStep > item.step ? "bg-accent" : "bg-white/20"
                    }`}
                  />
                )}
              </div>
                ))}
          </div>

          {!showConfirmEmail && (
            <div className="flex-1 max-w-[160px] mx-3 sm:hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/90 text-xs font-medium">
                  Etapa {state.currentStep} de {totalSteps}
                </span>
                <span className="text-white/70 text-[10px]">
                  {stepLabels[state.currentStep - 1]?.time}
                </span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent"
                  initial={{ width: "20%" }}
                  animate={{ width: `${(state.currentStep / totalSteps) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 md:gap-4">
            <Link
              to="/login"
              className="text-white/80 hover:text-white text-xs md:text-sm transition-colors"
            >
              Já tenho conta
            </Link>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-white/80 hover:text-white transition-colors p-1"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="pt-20 sm:pt-20 md:pt-24 lg:pt-28 pb-6 sm:pb-8 md:pb-12 px-3 sm:px-4">
        <div className="w-full mx-auto flex gap-4 lg:gap-8 justify-center">
          <div className="w-full max-w-4xl min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={showConfirmEmail ? "confirm-email" : state.currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 lg:p-10"
              >
                {showConfirmEmail ? (
                  <ConfirmEmailScreen email={state.orderCreatedEmail!} />
                ) : (
                  <>
                {state.currentStep === 1 && (
                  <>
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-3 sm:mb-4 md:mb-6">
                      <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Leva menos de</span> 2 min
                      </div>
                      <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium">
                        <Shield className="w-3.5 h-3.5" />
                        Pagamento Protegido
                      </div>
                    </div>
                    <div className="text-center mb-4 sm:mb-6">
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1.5 sm:mb-2">
                        Contrate profissionais verificados{" "}
                        <span className="md:block">com segurança e tranquilidade.</span>
                      </h1>
                      <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
                        Receba até 3 orçamentos de especialistas qualificados.{" "}
                        <span className="font-medium text-accent">Você só paga quando o trabalho for aprovado.</span>
                      </p>
                    </div>
                  </>
                )}
                {state.currentStep === 2 && state.selectedService && (
                  <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4 md:mb-6">
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br ${getServiceCardStyle(state.selectedService.slug).color} flex items-center justify-center shrink-0`}
                    >
                      {(() => {
                        const { Icon } = getServiceCardStyle(state.selectedService.slug);
                        return <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />;
                      })()}
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary leading-tight">
                        Nos conte mais sobre o serviço
                      </h1>
                    </div>
                  </div>
                )}
                {currentRender()}

                {state.currentStep >= 3 && !showConfirmEmail && (
                  <div className="flex flex-col-reverse sm:flex-row flex-wrap justify-between gap-3 mt-6 pt-4 sm:mt-8 sm:pt-6 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-border text-foreground hover:bg-accent w-full sm:w-auto min-w-0"
                      onClick={handleBack}
                      disabled={state.currentStep === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1 shrink-0" />
                      Voltar
                    </Button>
                    {state.currentStep < totalSteps ? (
                      <Button
                        type="button"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto min-w-0"
                        onClick={handleNext}
                        disabled={state.generatingDescription || (state.currentStep === 3 && !isDescriptionStepValid) || (state.currentStep === 4 && !isAddressStepValid)}
                      >
                        Próximo
                        <ChevronRight className="h-4 w-4 ml-1 shrink-0" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto min-w-0"
                        onClick={handleSubmit}
                        disabled={state.loading || !isFinalStepValid}
                      >
                        {state.loading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
                        ) : null}
                        Enviar pedido
                      </Button>
                    )}
                  </div>
                )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {state.currentStep === 1 && (
              <div className="lg:hidden mt-4">
                <TrustSidebar variant="mobile" />
              </div>
            )}
          </div>

          <aside className="hidden lg:block w-64 xl:w-72 shrink-0">
            <div className="sticky top-20 lg:top-24">
              <TrustSidebar variant="desktop" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
