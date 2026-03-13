import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Dummy page for testing dashboard entrypoint and navigation.
 * Will be replaced with real service requests list.
 */
export function ServiceRequestsPage() {
  return (
    <div className="container max-w-4xl px-4 py-6">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Solicitações / Meus pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Página de teste do módulo view-service-requests. Aqui será exibida a lista de solicitações de orçamento.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Conteúdo em construção. Navegue pelo menu para testar o layout responsivo (desktop: menu no topo, mobile: bottom nav + hamburger).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
