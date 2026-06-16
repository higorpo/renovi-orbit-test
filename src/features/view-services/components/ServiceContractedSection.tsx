import { Calendar, CircleCheck, User } from "lucide-react";
import type { ContractedServiceSummary } from "../types/service.types";
import { formatShift } from "../utils/formatShift";
import { ServiceDetailSection } from "./ServiceDetailSection";

interface ServiceContractedSectionProps {
  contracted: ContractedServiceSummary;
}

export function ServiceContractedSection({ contracted }: ServiceContractedSectionProps) {
  const providerName = contracted.provider?.displayName;

  return (
    <ServiceDetailSection
      title="Serviço contratado"
      className="border-primary/15 bg-primary-soft/50 shadow-none"
    >
      <div className="space-y-2.5 text-caption text-body">
        {providerName ? (
          <p className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              Profissional: <span className="font-medium text-ink">{providerName}</span>
            </span>
          </p>
        ) : null}
        <p className="flex items-center gap-2">
          <CircleCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Status: <span className="font-medium text-ink">{contracted.status}</span>
          </span>
        </p>
        {contracted.scheduledStartDate ? (
          <p className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              Agendado para {contracted.scheduledStartDate}
              {contracted.scheduledEndDate ? ` até ${contracted.scheduledEndDate}` : ""}
              {contracted.scheduledShift ? ` (${formatShift(contracted.scheduledShift)})` : ""}
            </span>
          </p>
        ) : null}
      </div>
    </ServiceDetailSection>
  );
}
