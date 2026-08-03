import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { useProviderKycWizard } from "../hooks/useProviderKycWizard";
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
      <div className="flex min-h-[70dvh] flex-col">
        <div className="flex-1 space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {wizard.progressLabel} · {wizard.stepLabel}
            </p>
            <h1 className="text-xl font-semibold">Bem-vindo à Renovi</h1>
            <p className="text-sm text-muted-foreground">
              É um prazer ter você conosco. Sua conta está quase pronta, complete
              o onboarding de segurança da Renovi para começar a prestar serviços
              na plataforma.
            </p>
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

        <div className="mt-6 flex gap-3">
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
