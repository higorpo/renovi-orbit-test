import type { ServiceDetailReturnTo } from "../types/serviceDetailNavigation.types";

export function getServiceDetailBackNavigation(params: {
  isClient: boolean;
  returnTo?: ServiceDetailReturnTo;
}): { href: string; label: string } {
  if (params.returnTo === "/dashboard/jobs" || (!params.isClient && !params.returnTo)) {
    return { href: "/dashboard/jobs", label: "Voltar para Trabalhos" };
  }

  return { href: "/dashboard/services", label: "Voltar para Meus Serviços" };
}
