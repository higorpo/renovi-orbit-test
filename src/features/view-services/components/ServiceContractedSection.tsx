import { Calendar, User } from "lucide-react";
import type { ContractedServiceSummary } from "../types/service.types";

interface ServiceContractedSectionProps {
  contracted: ContractedServiceSummary;
}

function formatShift(shift: string): string {
  switch (shift) {
    case "morning":
      return "Manhã";
    case "afternoon":
      return "Tarde";
    case "full_day":
      return "Dia inteiro";
    default:
      return shift;
  }
}

export function ServiceContractedSection({ contracted }: ServiceContractedSectionProps) {
  const providerName = contracted.provider?.displayName;

  return (
    <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold text-foreground">Serviço contratado</h3>
      {providerName ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4 shrink-0" aria-hidden />
          <span>Profissional: {providerName}</span>
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">Status: {contracted.status}</p>
      {contracted.scheduledStartDate ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Agendado para {contracted.scheduledStartDate}
            {contracted.scheduledEndDate ? ` até ${contracted.scheduledEndDate}` : ""}
            {contracted.scheduledShift ? ` (${formatShift(contracted.scheduledShift)})` : ""}
          </span>
        </p>
      ) : null}
    </section>
  );
}
