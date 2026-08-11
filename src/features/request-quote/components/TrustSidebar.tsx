import { Check, Shield, Star, Users } from "lucide-react";

interface TrustSidebarProps {
  variant?: "desktop" | "mobile";
}

export function TrustSidebar({ variant = "desktop" }: TrustSidebarProps) {
  const isDesktop = variant === "desktop";

  return (
    <div className={isDesktop ? "space-y-4" : "space-y-4"}>
      <div className="bg-white rounded-xl p-4 xl:p-5 shadow-md border border-border">
        <h3 className="font-semibold text-foreground mb-3 text-sm xl:text-base">
          Por que usar a Prestway?
        </h3>
        <div className="space-y-2.5">
          <div className="flex gap-2.5">
            <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-xs xl:text-sm">Profissionais verificados</p>
              <p className="text-[10px] xl:text-xs text-muted-foreground">Checagem de antecedentes</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-xs xl:text-sm">Pagamento protegido</p>
              <p className="text-[10px] xl:text-xs text-muted-foreground">Só pague após aprovar</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Star className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-xs xl:text-sm">Satisfação garantida</p>
              <p className="text-[10px] xl:text-xs text-muted-foreground">Nota média 4.8/5</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-xs xl:text-sm">Atendimento humano</p>
              <p className="text-[10px] xl:text-xs text-muted-foreground">Suporte se precisar</p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 xl:p-5 shadow-md border border-border">
        <h4 className="font-semibold text-foreground mb-3 text-xs xl:text-sm flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          O que dizem nossos clientes
        </h4>
        <div className="space-y-3">
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex gap-0.5 mb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-[11px] xl:text-xs text-muted-foreground leading-relaxed">
              &quot;Pedi orçamento de pintura e em 2 horas já tinha 3 profissionais me respondendo. Muito prático!&quot;
            </p>
            <p className="font-medium text-[10px] xl:text-xs mt-2">Marina C.</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex gap-0.5 mb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-[11px] xl:text-xs text-muted-foreground leading-relaxed">
              &quot;O eletricista foi super pontual e resolveu tudo. O sistema de pagamento me deu muita segurança.&quot;
            </p>
            <p className="font-medium text-[10px] xl:text-xs mt-2">João M.</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/50 text-center">
          <p className="text-[10px] xl:text-xs text-muted-foreground">
            <span className="font-semibold text-copper">98% de satisfação</span>
          </p>
        </div>
      </div>
    </div>
  );
}
