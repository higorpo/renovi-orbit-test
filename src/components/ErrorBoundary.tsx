import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureException, captureUserFeedback } from "@/lib/sentry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | undefined;
  feedbackSent: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, eventId: undefined, feedbackSent: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const eventId = captureException(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });
    this.setState({ eventId });
  }

  handleFeedbackSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const form = e.currentTarget;
    const comments = (form.elements.namedItem("comments") as HTMLTextAreaElement | null)?.value?.trim() ?? "";
    const email = (form.elements.namedItem("email") as HTMLInputElement | null)?.value?.trim() ?? "";
    const { eventId } = this.state;
    if (eventId) {
      captureUserFeedback({ event_id: eventId, comments: comments || "(sem descrição)", email: email || undefined });
      this.setState({ feedbackSent: true });
    }
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      const { eventId, feedbackSent } = this.state;
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-lg font-semibold">Algo deu errado</h2>
          <p className="max-w-md text-muted-foreground text-sm">
            Ocorreu um erro inesperado. O time foi notificado. Tente recarregar a página.
          </p>
          {eventId && !feedbackSent && (
            <form
              onSubmit={this.handleFeedbackSubmit}
              className="flex w-full max-w-sm flex-col gap-3 text-left"
            >
              <Label htmlFor="error-feedback-comments">O que você estava fazendo? (opcional)</Label>
              <Textarea
                id="error-feedback-comments"
                name="comments"
                placeholder="Descreva o que aconteceu..."
                rows={3}
                className="resize-none"
              />
              <Label htmlFor="error-feedback-email">Seu e-mail (opcional)</Label>
              <Input id="error-feedback-email" name="email" type="email" placeholder="email@exemplo.com" />
              <Button type="submit" variant="secondary" size="sm">
                Enviar feedback
              </Button>
            </form>
          )}
          {feedbackSent && (
            <p className="text-muted-foreground text-sm">Obrigado pelo feedback.</p>
          )}
          <Button
            variant="outline"
            onClick={() => {
              this.setState({ hasError: false, error: null, eventId: undefined, feedbackSent: false });
              window.location.href = "/";
            }}
          >
            Voltar ao início
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
