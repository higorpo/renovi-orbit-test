/**
 * Client-specific success body after confirm-with-rating or optional rating.
 * Layout/chrome live in CompletionSuccessStep + immersive sheet chrome.
 */

import { ClipboardList, Heart, History } from "lucide-react";
import {
  CompletionSuccessStep,
  type CompletionSuccessTip,
} from "./CompletionSuccessStep";

export type ClientEvaluateSuccessMode = "confirm" | "optional";

export type ClientEvaluateSuccessStepProps = {
  onDismiss: () => void;
  /** confirm = recebimento + avaliação; optional = só nota pós auto-complete. */
  mode?: ClientEvaluateSuccessMode;
  className?: string;
};

const CONFIRM_TIPS: readonly CompletionSuccessTip[] = [
  {
    icon: ClipboardList,
    title: "Serviço concluído",
    body: "Sua confirmação finalizou o contrato neste serviço no app.",
  },
  {
    icon: Heart,
    title: "Avaliação registrada",
    body: "Suas notas ajudam a manter a qualidade dos profissionais na plataforma.",
  },
  {
    icon: History,
    title: "Histórico disponível",
    body: "Você pode rever este serviço quando quiser em Meus Serviços.",
  },
];

const OPTIONAL_TIPS: readonly CompletionSuccessTip[] = [
  {
    icon: Heart,
    title: "Avaliação registrada",
    body: "Suas notas foram salvas e ajudam outros clientes e o profissional.",
  },
  {
    icon: ClipboardList,
    title: "Serviço já estava concluído",
    body: "A conclusão automática já tinha finalizado o contrato; você só reforçou com a avaliação.",
  },
  {
    icon: History,
    title: "Histórico disponível",
    body: "Você pode rever este serviço quando quiser em Meus Serviços.",
  },
];

export function ClientEvaluateSuccessStep({
  onDismiss,
  mode = "confirm",
  className,
}: ClientEvaluateSuccessStepProps) {
  const isOptional = mode === "optional";

  return (
    <CompletionSuccessStep
      className={className}
      testId="client-evaluate-success"
      dismissTestId="client-evaluate-success-dismiss"
      eyebrow={isOptional ? "Avaliação enviada" : "Tudo certo"}
      title="Obrigado pela sua avaliação!"
      description={
        isOptional
          ? "Recebemos suas notas. Sua opinião ajuda a melhorar a experiência na Renovi."
          : "Confirmamos o recebimento do serviço e registramos sua avaliação no app."
      }
      tipsHeading="O que acontece agora"
      tipsSubheading={
        isOptional
          ? "Resumo do que foi feito com a sua avaliação."
          : "Resumo do que foi concluído com a sua confirmação."
      }
      tips={isOptional ? OPTIONAL_TIPS : CONFIRM_TIPS}
      onDismiss={onDismiss}
    />
  );
}
