import { useParams, Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

/**
 * Placeholder for service detail page. Replace with full implementation when ready.
 */
export function ServiceDetailPlaceholder() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="container max-w-4xl px-4 py-6">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/dashboard/requests">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para Meus Serviços
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Detalhe do serviço</h1>
          <p className="text-sm text-muted-foreground">
            Página em construção. ID: {id ?? "—"}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Aqui serão exibidos os detalhes completos do serviço, orçamentos e
            ações.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
