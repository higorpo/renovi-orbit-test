import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { useProviderKycWizard } from "../hooks/useProviderKycWizard";
import { KycWizardStepper } from "./KycWizardStepper";
import {
  ProviderKycWizardStepContent,
  WizardFooterPendingLabel,
} from "./ProviderKycWizardStepContent";

export type ProviderKycFormProps = {
  providerId: string;
  accountEmail: string;
  defaultPhone?: string;
  defaultFullName?: string;
  onSubmitted?: () => void;
};

export function ProviderKycForm({
  providerId,
  accountEmail,
  defaultPhone,
  defaultFullName,
  onSubmitted,
}: ProviderKycFormProps) {
  const wizard = useProviderKycWizard({
    providerId,
    accountEmail,
    defaultPhone,
    defaultFullName,
    onSubmitted,
  });

  return (
    <Form {...wizard.form}>
      <div className="flex min-h-full flex-1 flex-col">
        <div className="space-y-6">
          <div className="space-y-3">
            <KycWizardStepper
              currentStep={wizard.stepIndex + 1}
              totalSteps={wizard.totalSteps}
            />
            {wizard.isFirstStep ? (
              <div className="space-y-2">
                <h1 className="text-xl font-semibold">Boas-vindas à Prestway</h1>
                <p className="text-sm text-muted-foreground">
                  É um prazer ter você conosco. Sua conta está quase pronta, complete
                  o onboarding de segurança da Prestway para começar a prestar serviços
                  na plataforma.
                </p>
              </div>
            ) : (
              <h1 className="text-xl font-semibold">{wizard.stepLabel}</h1>
            )}
          </div>

          {wizard.isPrefilling ? (
            <p className="text-sm text-muted-foreground">Carregando seus dados…</p>
          ) : (
            <ProviderKycWizardStepContent
              step={wizard.step}
              form={wizard.form}
              isCnpj={wizard.isCnpj}
              disabled={wizard.isSubmitting}
            />
          )}

          {wizard.stepError ? (
            <p className="text-sm text-destructive" role="alert">
              {wizard.stepError}
            </p>
          ) : null}

          {wizard.submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {wizard.submitError}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex shrink-0 gap-3 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
          {!wizard.isFirstStep ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              disabled={wizard.isSubmitting}
              onClick={wizard.goBack}
            >
              Voltar
            </Button>
          ) : null}

          {wizard.isLastStep ? (
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={wizard.isSubmitting || wizard.isPrefilling}
              onClick={() => void wizard.submit()}
            >
              {wizard.isSubmitting ? <WizardFooterPendingLabel /> : "Enviar"}
            </Button>
          ) : (
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={wizard.isSubmitting || wizard.isPrefilling}
              onClick={wizard.goNext}
            >
              Continuar
            </Button>
          )}
        </div>
      </div>
    </Form>
  );
}
