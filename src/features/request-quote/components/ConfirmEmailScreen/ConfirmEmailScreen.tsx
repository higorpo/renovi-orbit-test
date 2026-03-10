import { Mail, CheckCircle } from "lucide-react";
import { Link } from "react-router";

export interface ConfirmEmailScreenProps {
  email: string;
}

export function ConfirmEmailScreen({ email }: ConfirmEmailScreenProps) {
  return (
    <div className="text-center py-6 sm:py-8">
      <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-100 text-green-600 mb-4 sm:mb-6">
        <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8" />
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-primary mb-2">
        Pedido de orçamento enviado com sucesso
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Agora é preciso confirmar seu e-mail para que profissionais possam ver e responder ao seu pedido.
      </p>
      <div className="flex flex-col items-center gap-2 mb-8">
        <span className="text-sm text-muted-foreground">Enviamos um link de confirmação para:</span>
        <div className="inline-flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground break-all">{email}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Abra seu e-mail e clique no link para ativar sua conta.
        </p>
      </div>
      <Link
        to="/login"
        className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-2.5 font-medium hover:bg-primary/90 transition-colors"
      >
        Ir para o login
      </Link>
    </div>
  );
}
