import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function ProviderProfileCtaBanner() {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-6 sm:p-8 text-center text-primary-foreground">
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
        Precisa de um serviço para sua casa?
      </h2>
      <p className="mt-2 text-sm sm:text-base text-primary-foreground/80 max-w-md mx-auto">
        Na Prestway você encontra profissionais qualificados e recebe orçamentos
        sem compromisso. Rápido, fácil e gratuito.
      </p>
      <Button
        asChild
        size="lg"
        className="mt-5 bg-white text-primary hover:bg-white/90 font-semibold shadow-md"
      >
        <Link to="/pedir-orcamento">
          Pedir orçamento grátis
          <ArrowRight className="h-4 w-4 ml-1" aria-hidden />
        </Link>
      </Button>
    </section>
  );
}
