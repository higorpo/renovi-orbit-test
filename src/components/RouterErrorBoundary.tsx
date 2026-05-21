import { useRouteError, isRouteErrorResponse } from "react-router";
import { CapacitorSplashHider } from "@/lib/capacitor";
import { captureException, captureUserFeedback } from "@/lib/sentry";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RouterErrorBoundary() {
  const error = useRouteError();
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    const toReport = isRouteErrorResponse(error)
      ? new Error(`${error.status} ${error.statusText}: ${error.data}`)
      : error instanceof Error
        ? error
        : new Error(String(error));
    const id = captureException(toReport, {
      routerError: true,
      isRouteErrorResponse: isRouteErrorResponse(error),
      ...(isRouteErrorResponse(error) && { status: error.status, statusText: error.statusText }),
    });
    setEventId(id);
  }, [error]);

  const handleFeedbackSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const form = e.currentTarget;
    const comments = (form.elements.namedItem("comments") as HTMLTextAreaElement | null)?.value?.trim() ?? "";
    const email = (form.elements.namedItem("email") as HTMLInputElement | null)?.value?.trim() ?? "";
    if (eventId) {
      captureUserFeedback({ event_id: eventId, comments: comments || "(sem descrição)", email: email || undefined });
      setFeedbackSent(true);
    }
  };

  const message =
    isRouteErrorResponse(error) && typeof error.data === "string"
      ? error.data
      : error instanceof Error
        ? error.message
        : "Algo deu errado";

  return (
    <>
      <CapacitorSplashHider />
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Erro ao carregar a página</h2>
      <p className="max-w-md text-muted-foreground text-sm">{message}</p>
      {eventId && !feedbackSent && (
        <form
          onSubmit={handleFeedbackSubmit}
          className="flex w-full max-w-sm flex-col gap-3 text-left"
        >
          <Label htmlFor="router-error-feedback-comments">O que você estava fazendo? (opcional)</Label>
          <Textarea
            id="router-error-feedback-comments"
            name="comments"
            placeholder="Descreva o que aconteceu..."
            rows={3}
            className="resize-none"
          />
          <Label htmlFor="router-error-feedback-email">Seu e-mail (opcional)</Label>
          <Input id="router-error-feedback-email" name="email" type="email" placeholder="email@exemplo.com" />
          <Button type="submit" variant="secondary" size="sm">
            Enviar feedback
          </Button>
        </form>
      )}
      {feedbackSent && (
        <p className="text-muted-foreground text-sm">Obrigado pelo feedback.</p>
      )}
      <Button variant="outline" onClick={() => window.location.replace("/")}>
        Voltar ao início
      </Button>
    </div>
    </>
  );
}
