import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function ForgotPasswordSuccess() {
  return (
    <div className="text-center">
      <div className="mb-6">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-400" strokeWidth={2} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Email enviado!</h2>
        <p className="text-white/70">
          Se este email estiver cadastrado, você receberá um link de redefinição
          de senha em alguns minutos.
        </p>
        <p className="text-white/50 text-sm mt-4">
          Não se esqueça de verificar sua caixa de spam.
        </p>
      </div>

      <Button asChild className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
        <Link to="/login">Voltar para Login</Link>
      </Button>
    </div>
  );
}
