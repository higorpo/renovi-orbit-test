import { ShieldCheck } from "lucide-react";

const termsUrl = `${(import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "")}/juridico/termos-de-uso`;

export function PaymentTrustDisclosure() {
  return (
    <section
      className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3"
      aria-label="Informações sobre pagamento seguro"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">
            Pagamento protegido por parceiro certificado
          </p>
          <p className="text-muted-foreground">
            Seus dados de cartão são enviados com segurança ao nosso parceiro de
            pagamentos para tokenização. A Prestway não armazena o número completo
            do cartão nem o CVV — apenas referências tokenizadas. O envio passa
            por um serviço seguro da plataforma até o gateway (o cartão não fica
            gravado nos nossos sistemas).
          </p>
          <p className="text-muted-foreground">
            Ao confirmar, você declara que leu e aceita os{" "}
            <a
              href={termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Termos de Uso
            </a>
            , incluindo as regras de cobrança, cancelamento e reembolso. As taxas de cartão
            podem ser recalculadas no momento da cobrança (cerca de 48 horas antes do
            serviço, ou imediatamente em casos urgentes) conforme a bandeira e o número de
            parcelas então vigentes — o valor final cobrado pode diferir levemente da
            estimativa exibida no checkout.
          </p>
        </div>
      </div>
    </section>
  );
}
