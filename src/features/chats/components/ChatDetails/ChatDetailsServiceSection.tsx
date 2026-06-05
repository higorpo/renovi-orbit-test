import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  getServiceDetailPath,
  SimpleServiceCard,
  SimpleServiceCardSkeleton,
  useService,
} from "@/features/view-services";

export interface ChatDetailsServiceSectionProps {
  serviceRequestId: string;
}

export function ChatDetailsServiceSection({ serviceRequestId }: ChatDetailsServiceSectionProps) {
  const { data: service, isLoading, isError, refetch } = useService(serviceRequestId);

  if (isLoading) {
    return <SimpleServiceCardSkeleton compact />;
  }

  if (isError || !service) {
    return (
      <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os detalhes do serviço.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SimpleServiceCard model={service} compact />
      <Button variant="outline" className="w-full" asChild>
        <Link to={getServiceDetailPath(serviceRequestId)}>Ver mais detalhes do serviço</Link>
      </Button>
    </div>
  );
}
