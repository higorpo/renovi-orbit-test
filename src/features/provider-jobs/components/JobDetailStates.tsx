import { ArrowLeft, Briefcase } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export function JobDetailNotFound() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Briefcase className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold">
        Trabalho não encontrado
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Este trabalho pode não estar mais disponível. Volte para a lista de
        trabalhos para ver oportunidades atuais.
      </p>
      <Button variant="outline" size="sm" asChild className="mt-4">
        <Link to="/dashboard/jobs">Ver trabalhos</Link>
      </Button>
    </div>
  );
}

export function JobDetailBackLink() {
  return (
    <div className="mb-4">
      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <Link to="/dashboard/jobs">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para Trabalhos
        </Link>
      </Button>
    </div>
  );
}
