/**
 * Query param when opening a job detail from another dashboard area.
 * Only whitelisted values are handled (avoid open redirects).
 */
export const JOB_DETAIL_FROM_PARAM = "from" as const;
export const JOB_DETAIL_FROM_BUDGETS_VALUE = "budgets" as const;

export type JobDetailReturnNav = {
  href: string;
  backLabel: string;
  notFoundCtaLabel: string;
  notFoundDescription: string;
};

export function getJobDetailReturnNavigation(
  from: string | null,
): JobDetailReturnNav {
  if (from === JOB_DETAIL_FROM_BUDGETS_VALUE) {
    return {
      href: "/dashboard/budgets",
      backLabel: "Voltar para Orçamentos",
      notFoundCtaLabel: "Ver orçamentos",
      notFoundDescription:
        "Este trabalho pode não estar mais disponível. Volte para Orçamentos para ver seus orçamentos e perguntas.",
    };
  }
  return {
    href: "/dashboard/jobs",
    backLabel: "Voltar para Trabalhos",
    notFoundCtaLabel: "Ver trabalhos",
    notFoundDescription:
      "Este trabalho pode não estar mais disponível. Volte para a lista de trabalhos para ver oportunidades atuais.",
  };
}

/** Link de Orçamentos → detalhe do pedido (rota sob /dashboard/budgets, sheet sobre a lista). */
export function jobDetailPathFromBudgets(serviceRequestId: string): string {
  return `/dashboard/budgets/pedido/${serviceRequestId}?${JOB_DETAIL_FROM_PARAM}=${JOB_DETAIL_FROM_BUDGETS_VALUE}`;
}
