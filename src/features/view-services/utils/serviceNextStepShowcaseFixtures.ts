import type { ServiceNextStep } from "./serviceNextStep";

export type ServiceNextStepShowcaseGroup = "Cliente" | "Prestador" | "Estados";

export type ServiceNextStepShowcaseVariant = {
  id: string;
  group: ServiceNextStepShowcaseGroup;
  label: string;
  description: string;
  step: ServiceNextStep;
  disabled?: boolean;
};

function step(
  partial: Omit<ServiceNextStep, "eyebrow"> & { eyebrow?: ServiceNextStep["eyebrow"] },
): ServiceNextStep {
  return {
    eyebrow: "Próximo passo",
    ...partial,
  };
}

/** Static fixtures covering every ServiceNextStepCard visual/intent variant. */
export function buildServiceNextStepShowcaseVariants(): ServiceNextStepShowcaseVariant[] {
  return [
    {
      id: "client-adjust-payment",
      group: "Cliente",
      label: "Pagamento pendente (FAILED_PERMANENT)",
      description: "CTA Pagar agora + footer de segurança (lock).",
      step: step({
        intent: "adjust_payment",
        title: "Pagamento pendente",
        description:
          "Atualize suas informações de pagamento manualmente para confirmar o serviço.",
        actionLabel: "Pagar agora",
        icon: "credit_card",
        trustFooter: {
          icon: "lock",
          text: "Ambiente seguro e criptografado",
        },
      }),
    },
    {
      id: "client-evaluate-executed",
      group: "Cliente",
      label: "Avaliar serviço (EXECUTED)",
      description: "Confirmar conclusão + avaliação obrigatória.",
      step: step({
        intent: "evaluate_service",
        title: "Aceite a conclusão e avalie o serviço",
        description:
          "O prestador enviou as evidências — confirme a conclusão e deixe sua avaliação",
        actionLabel: "Avaliar serviço",
        icon: "star",
      }),
    },
    {
      id: "client-evaluate-completed",
      group: "Cliente",
      label: "Avaliar serviço (COMPLETED sem nota)",
      description: "Avaliação opcional pós auto-complete.",
      step: step({
        intent: "evaluate_service",
        title: "Avalie o serviço",
        description: "O serviço foi concluído. Você ainda pode deixar uma avaliação",
        actionLabel: "Avaliar serviço",
        icon: "star",
      }),
    },
    {
      id: "client-budgets-pending-one",
      group: "Cliente",
      label: "Orçamento pendente (1)",
      description: "Footer shield + CTA Ver/Comparar orçamento.",
      step: step({
        intent: "budgets",
        title: "Novo orçamento para analisar",
        description: "1 orçamento aguardando sua resposta",
        actionLabel: "Ver orçamento",
        icon: "file_text",
        trustFooter: {
          icon: "shield",
          text: "Compare com tranquilidade — sem compromisso",
        },
      }),
    },
    {
      id: "client-budgets-pending-many",
      group: "Cliente",
      label: "Orçamentos pendentes (N)",
      description: "Vários orçamentos aguardando resposta.",
      step: step({
        intent: "budgets",
        title: "Novos orçamentos para analisar",
        description: "3 orçamentos aguardando sua resposta",
        actionLabel: "Comparar orçamentos",
        icon: "file_text",
        trustFooter: {
          icon: "shield",
          text: "Compare com tranquilidade — sem compromisso",
        },
      }),
    },
    {
      id: "client-budgets-received",
      group: "Cliente",
      label: "Orçamentos recebidos (sem pending)",
      description: "Copy de comparação quando não há pending.",
      step: step({
        intent: "budgets",
        title: "Orçamentos recebidos",
        description: "Compare valores e prazos antes de decidir",
        actionLabel: "Comparar orçamentos",
        icon: "file_text",
        trustFooter: {
          icon: "shield",
          text: "Compare com tranquilidade — sem compromisso",
        },
      }),
    },
    {
      id: "client-chat-unread-named",
      group: "Cliente",
      label: "Nova mensagem (1, com nome)",
      description: "Título personalizado com o prestador.",
      step: step({
        intent: "chat",
        title: "Nova mensagem de João Silva",
        description: "Posso ir amanhã pela manhã, combina?",
        actionLabel: "Ver mensagem",
        icon: "message",
      }),
    },
    {
      id: "client-messages-unread-many",
      group: "Cliente",
      label: "Mensagens novas (várias conversas)",
      description: "Intent messages quando há múltiplos unreads.",
      step: step({
        intent: "messages",
        title: "Mensagens novas de prestadores",
        description: "2 conversas com mensagens novas",
        actionLabel: "Ver mensagens",
        icon: "message",
      }),
    },
    {
      id: "client-chat-no-unread",
      group: "Cliente",
      label: "Conversa sem unread",
      description: "Fallback acionável de chat em andamento.",
      step: step({
        intent: "chat",
        title: "Fale com o prestador",
        description: "Tire dúvidas e alinhe os detalhes do serviço",
        actionLabel: "Ver conversa com prestador",
        icon: "message",
      }),
    },
    {
      id: "provider-chat-unread",
      group: "Prestador",
      label: "Nova mensagem recebida",
      description: "Unread do cliente com preview.",
      step: step({
        intent: "chat",
        title: "Nova mensagem recebida",
        description: "Você consegue chegar um pouco mais cedo?",
        actionLabel: "Responder",
        icon: "message",
      }),
    },
    {
      id: "provider-chat-start",
      group: "Prestador",
      label: "Iniciar negociação",
      description: "Sem chat ainda — CTA inicia conversa (como o FAB).",
      step: step({
        intent: "chat",
        title: "Inicie a negociação",
        description:
          "Comece a conversa com o cliente para tirar dúvidas e alinhar o serviço",
        actionLabel: "Iniciar negociação",
        icon: "message",
      }),
    },
    {
      id: "provider-chat-no-unread",
      group: "Prestador",
      label: "Negociação / conversa",
      description: "Chat acionável sem unread.",
      step: step({
        intent: "chat",
        title: "Fale com o cliente",
        description: "Continue a negociação ou tire dúvidas sobre o serviço",
        actionLabel: "Ver negociação",
        icon: "message",
      }),
    },
    {
      id: "provider-revise-proposal",
      group: "Prestador",
      label: "Revisar proposta",
      description: "Cliente pediu revisão da proposta.",
      step: step({
        intent: "revise_proposal",
        title: "Cliente solicitou revisão",
        description: "Atualize sua proposta com os ajustes pedidos",
        actionLabel: "Revisar proposta",
        icon: "pencil",
      }),
    },
    {
      id: "provider-view-proposal",
      group: "Prestador",
      label: "Ver proposta",
      description: "Proposta enviada aguardando decisão.",
      step: step({
        intent: "view_proposal",
        title: "Acompanhe sua proposta",
        description: "Veja os detalhes enviados e o status da análise",
        actionLabel: "Ver proposta",
        icon: "eye",
      }),
    },
    {
      id: "provider-mark-executed",
      group: "Prestador",
      label: "Marcar como executado",
      description: "CONFIRMED + past — CTA Concluir serviço.",
      step: step({
        intent: "mark_executed",
        title: "Marque o serviço como executado",
        description: "Adicione as evidências de conclusão para finalizar o serviço",
        actionLabel: "Concluir serviço",
        icon: "check_circle",
      }),
    },
    {
      id: "provider-open-map",
      group: "Prestador",
      label: "Abrir no mapa (serviço hoje)",
      description: "Timing today — CTA de localização.",
      step: step({
        intent: "open_map",
        title: "Serviço hoje",
        description: "Abra o mapa para ir até o local do serviço",
        actionLabel: "Abrir no mapa",
        icon: "map_pin",
      }),
    },
    {
      id: "state-mark-executed-disabled",
      group: "Estados",
      label: "Concluir serviço (disabled)",
      description: "enrichmentReady=false — tooltip com disabledReason.",
      step: step({
        intent: "mark_executed",
        title: "Marque o serviço como executado",
        description: "Adicione as evidências de conclusão para finalizar o serviço",
        actionLabel: "Concluir serviço",
        icon: "check_circle",
        disabled: true,
        disabledReason: "Aguarde o processamento das informações do serviço.",
      }),
    },
    {
      id: "state-chat-disabled",
      group: "Estados",
      label: "Chat disabled (sem chatId)",
      description: "Botão desabilitado via prop disabled + reason no step.",
      step: step({
        intent: "chat",
        title: "Fale com o cliente",
        description: "Continue a negociação ou tire dúvidas sobre o serviço",
        actionLabel: "Ver conversa",
        icon: "message",
        disabled: true,
        disabledReason: "Conversa ainda não disponível.",
      }),
    },
    {
      id: "state-payment-external-disabled",
      group: "Estados",
      label: "Pagamento (disabled externo)",
      description: "Card habilitado no step, mas CTA desabilitado pela prop disabled (loading).",
      disabled: true,
      step: step({
        intent: "adjust_payment",
        title: "Pagamento pendente",
        description: "Para confirmar o agendamento, realize o pagamento do serviço.",
        actionLabel: "Pagar agora",
        icon: "credit_card",
        trustFooter: {
          icon: "lock",
          text: "Ambiente seguro e criptografado",
        },
      }),
    },
  ];
}
