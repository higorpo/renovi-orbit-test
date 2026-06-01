import type { ProfileRole } from "@/features/auth";

export interface ChatDiscoveryWelcomeContent {
  title: string;
  body: string;
}

export function getChatDiscoveryWelcomeContent(
  viewerRole: ProfileRole,
): ChatDiscoveryWelcomeContent {
  if (viewerRole === "provider") {
    return {
      title: "Comece a negociação",
      body:
        "Apresente-se, tire dúvidas sobre o pedido e envie sua proposta quando estiver pronto. Mensagens claras e fotos do serviço ajudam o cliente a decidir com confiança.",
    };
  }

  return {
    title: "Negocie com o prestador",
    body:
      "Use esta conversa para tirar dúvidas, combinar detalhes do serviço e analisar propostas. Quando receber uma proposta, você pode aceitar, pedir revisão ou recusar pelo card na conversa.",
  };
}
