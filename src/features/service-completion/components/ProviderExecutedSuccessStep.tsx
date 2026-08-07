/**
 * Provider-specific success body after mark-executed.
 * Layout/chrome live in CompletionSuccessStep + immersive sheet chrome.
 */

import {
  ClipboardCheck,
  Images,
  MessageCircle,
} from "lucide-react";
import {
  CompletionSuccessStep,
  type CompletionSuccessTip,
} from "./CompletionSuccessStep";

export type ProviderExecutedSuccessStepProps = {
  onDismiss: () => void;
  className?: string;
};

const PROVIDER_TIPS: readonly CompletionSuccessTip[] = [
  {
    icon: MessageCircle,
    title: "Peça a confirmação",
    body: "Diga ao cliente que ele precisa confirmar o recebimento do serviço no app.",
  },
  {
    icon: Images,
    title: "Peça para revisar as evidências",
    body: "Oriente o cliente a abrir o checklist no app e verificar as fotos e respostas que você enviou.",
  },
  {
    icon: ClipboardCheck,
    title: "Lembre da avaliação",
    body: "Depois de aprovar, o cliente também pode deixar uma nota sobre o serviço no app.",
  },
];

export function ProviderExecutedSuccessStep({
  onDismiss,
  className,
}: ProviderExecutedSuccessStepProps) {
  return (
    <CompletionSuccessStep
      className={className}
      testId="provider-executed-success"
      dismissTestId="provider-executed-success-dismiss"
      eyebrow="Enviado ao cliente"
      title="Checklist enviado com sucesso"
      description="Suas respostas e evidências já estão disponíveis no app do cliente. Avise-o para revisar o que foi anexado e aprovar o serviço."
      tipsHeading="Avise o cliente"
      tipsSubheading="Peça para ele abrir o app, revisar as evidências e aprovar o serviço."
      tips={PROVIDER_TIPS}
      onDismiss={onDismiss}
    />
  );
}
