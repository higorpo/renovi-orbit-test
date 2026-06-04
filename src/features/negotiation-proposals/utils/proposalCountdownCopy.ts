import type { ProposalCopyVariant } from "../constants/proposalCopyVariants";
import type { ProposalCountdownSnapshot } from "./proposalCountdown";
import { formatProposalDateTime } from "./proposalDetailsFormatters";

export type ProposalCountdownAudience = "client" | "provider";

export interface ProposalCountdownCopy {
  title: string;
  body: string;
}

function resolveEntityLabel(copyVariant: ProposalCopyVariant): string {
  return copyVariant === "budget" ? "orçamento" : "proposta";
}

export function resolveProposalCountdownCopy(params: {
  audience: ProposalCountdownAudience;
  copyVariant: ProposalCopyVariant;
  snapshot: ProposalCountdownSnapshot;
  density: "default" | "compact";
}): ProposalCountdownCopy | null {
  const { audience, copyVariant, snapshot, density } = params;
  const entityLabel = resolveEntityLabel(copyVariant);

  if (snapshot.phase === "inactive" || !snapshot.remainingLabel) {
    return null;
  }

  const expiresAtLabel = snapshot.expiresAt
    ? formatProposalDateTime(snapshot.expiresAt.toISOString())
    : null;

  if (density === "compact") {
    if (snapshot.isExpired) {
      return audience === "client"
        ? { title: "Prazo encerrado", body: `O prazo para responder a este ${entityLabel} terminou.` }
        : { title: "Prazo encerrado", body: `O prazo de resposta do cliente terminou.` };
    }

    return audience === "client"
      ? {
          title: "Prazo para responder",
          body: `Restam ${snapshot.remainingLabel} para decidir.`,
        }
      : {
          title: "Aguardando resposta",
          body: `O cliente tem ${snapshot.remainingLabel} para responder.`,
        };
  }

  if (snapshot.isExpired) {
    return audience === "client"
      ? {
          title: "Prazo encerrado",
          body: `O prazo para aprovar ou recusar este ${entityLabel} terminou.`,
        }
      : {
          title: "Prazo encerrado",
          body: "O prazo para o cliente responder terminou.",
        };
  }

  if (audience === "client") {
    const deadlineSuffix = expiresAtLabel
      ? ` Aprove ou recuse até ${expiresAtLabel}.`
      : ".";

    if (snapshot.isWarning) {
      return {
        title: "Prazo quase encerrado",
        body: `Restam ${snapshot.remainingLabel} para decidir.${deadlineSuffix}`,
      };
    }

    return {
      title: "Prazo para responder",
      body: `Restam ${snapshot.remainingLabel} para decidir.${deadlineSuffix}`,
    };
  }

  const deadlineSuffix = expiresAtLabel ? ` (até ${expiresAtLabel}).` : ".";

  if (snapshot.isWarning) {
    return {
      title: "Prazo quase encerrado",
      body: `O cliente tem ${snapshot.remainingLabel} para responder${deadlineSuffix}`,
    };
  }

  return {
    title: "Aguardando resposta do cliente",
    body: `O cliente tem ${snapshot.remainingLabel} para decidir${deadlineSuffix}`,
  };
}
