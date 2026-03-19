import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useProviderJobDetail } from "../hooks/useProviderJobDetail";
import { JobDetailContent } from "./JobDetailContent";
import { JobDetailBackLink, JobDetailNotFound } from "./JobDetailStates";

export function JobDetailPage({ jobId }: { jobId: string }) {
  const { job, isLoading, isError, refetch } = useProviderJobDetail(jobId);

  return (
    <div className="container max-w-3xl px-4 py-6">
      <JobDetailBackLink />

      {isLoading && (
        <div
          className="flex justify-center py-16"
          aria-busy="true"
          aria-label="Carregando detalhes do trabalho"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar este trabalho.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            type="button"
            onClick={() => refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {!isLoading && !isError && job && <JobDetailContent job={job} />}

      {!isLoading && !isError && !job && <JobDetailNotFound />}
    </div>
  );
}
