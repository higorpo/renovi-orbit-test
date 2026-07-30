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
        <div className="flex-1 space-y-6 pb-28">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {wizard.progressLabel}
            </p>
            <h1 className="text-xl font-semibold">Credenciamento de pagamentos</h1>
            <p className="text-sm text-muted-foreground">
              {wizard.stepLabel}. Complete os passos para receber pagamentos pelos
              serviços na Renovi.
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

        <div
          className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
        >
          <div className="mx-auto flex max-w-2xl gap-3">
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
      </div>
    </Form>
  );
}
