import { useSearchParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import { useRequestQuoteState } from "../../hooks/useRequestQuoteState";
import { useRequestQuoteSubmit } from "../../hooks/useRequestQuoteSubmit";
import { useRequestQuoteNavigation } from "../../hooks/useRequestQuoteNavigation";
import { Step1ServiceSelect } from "./Step1ServiceSelect";
import { Step2ServiceForm } from "./Step2ServiceForm";
import { Step3DescriptionPhotos } from "./Step3DescriptionPhotos";
import { Step4Address } from "./Step4Address";
import { Step5Identity } from "./Step5Identity";

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

  const steps = [
    () => (
      <Step1ServiceSelect
        urlServiceSlug={urlServiceSlug}
        loadingSession={loadingSession}
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
      <Step3DescriptionPhotos state={state} />
    ),
    () => (
      <Step4Address
        user={user}
        onStep4DataChange={state.setStep4Data}
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary to-primary/90 overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-lg font-semibold text-white">Pedir orçamento</span>
          <span className="text-white/80 text-sm">
            Passo {state.currentStep} de {totalSteps}
          </span>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-24 pb-12 max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentRender()}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <Button
            type="button"
            variant="outline"
            className="border-white/30 text-white"
            onClick={handleBack}
            disabled={state.currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          {state.currentStep < totalSteps ? (
            <Button
              type="button"
              className="bg-white text-primary hover:bg-white/90"
              onClick={handleNext}
              disabled={state.generatingDescription}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-white text-primary hover:bg-white/90"
              onClick={handleSubmit}
              disabled={state.loading}
            >
              {state.loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Enviar pedido
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
