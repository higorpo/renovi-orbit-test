import { ArrowLeft, Briefcase } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import {
  getJobDetailReturnNavigation,
  JOB_DETAIL_FROM_PARAM,
} from "../constants/jobDetailReturnNavigation";

export function JobDetailNotFound() {
  const [searchParams] = useSearchParams();
  const from = searchParams.get(JOB_DETAIL_FROM_PARAM);
  const nav = getJobDetailReturnNavigation(from);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Briefcase className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold">
        Trabalho não encontrado
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {nav.notFoundDescription}
      </p>
      <Button variant="outline" size="sm" asChild className="mt-4">
        <Link to={nav.href}>{nav.notFoundCtaLabel}</Link>
      </Button>
    </div>
  );
}

export function JobDetailBackLink() {
  const [searchParams] = useSearchParams();
  const from = searchParams.get(JOB_DETAIL_FROM_PARAM);
  const nav = getJobDetailReturnNavigation(from);

  return (
    <div className="mb-4">
      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <Link to={nav.href}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {nav.backLabel}
        </Link>
      </Button>
    </div>
  );
}
