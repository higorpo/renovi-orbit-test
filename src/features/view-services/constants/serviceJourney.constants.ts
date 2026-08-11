import type { ServiceJourneyMilestoneKey } from "../types/serviceJourney.types";

export const SERVICE_JOURNEY_CARD_TITLE = "Acompanhe seu pedido";

export const SERVICE_JOURNEY_PAYMENT_LABEL_COMPLETED = "Pagamento confirmado";
export const SERVICE_JOURNEY_PAYMENT_LABEL_PENDING = "Pagamento pendente";

export const SERVICE_JOURNEY_LABELS: Record<ServiceJourneyMilestoneKey, string> = {
  request_created: "Pedido criado",
  professionals_interested: "Profissionais interessados",
  quote_received: "Orçamento recebido",
  quote_approved: "Orçamento aprovado",
  payment: SERVICE_JOURNEY_PAYMENT_LABEL_PENDING,
  service_scheduled: "Serviço agendado",
  service_executed: "Serviço executado",
  rating: "Avaliação",
  cancelled: "Pedido cancelado",
  in_dispute: "Em disputa",
};

export const SERVICE_JOURNEY_SUBTEXT = {
  nextStep: "Próximo passo",
  professionalsInterestedCurrent: "Aguardando contato",
  professionalsInterestedUpcoming: "Aguardando contato",
  quoteReceivedCurrent: "Aguardando orçamento",
  quoteReceivedUpcoming: "Aguardando orçamento",
  quoteApprovedCurrent: "Aguardando sua aprovação",
  quoteApprovedUpcoming: "Aguardando aprovação",
  paymentCurrent: "Aguardando pagamento",
  paymentUpcoming: "Aguardando pagamento",
  serviceScheduledCurrent: "Confirme a data com o profissional",
  serviceScheduledUpcoming: "Confirmação da agenda",
  serviceExecutedCurrent: "Aguardando execução",
  serviceExecutedUpcoming: "Aguardando execução",
  ratingExperience: "Conte sua experiência",
  ratingOptional: "Avaliação opcional",
  cancelledCurrent: "Jornada encerrada",
  inDisputeCurrent: "Aguardando análise",
} as const;

export const SERVICE_JOURNEY_MILESTONE_KEYS = [
  "request_created",
  "professionals_interested",
  "quote_received",
  "quote_approved",
  "payment",
  "service_scheduled",
  "service_executed",
  "rating",
  "cancelled",
  "in_dispute",
] as const satisfies readonly ServiceJourneyMilestoneKey[];
