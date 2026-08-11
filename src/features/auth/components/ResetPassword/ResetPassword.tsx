import { Link } from "react-router";
import { useResetPassword } from "../../hooks/useResetPassword";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { KeyRound } from "lucide-react";

export default function ResetPassword() {
  const form = useResetPassword();

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/hero-client.jpg)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/95 via-[#1E3A8A]/90 to-black/80" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <Link to="/">
              <img
                src="/logo-renovi-white.webp"
                alt="Renovi"
                className="h-10"
              />
            </Link>
          </div>

          {form.recoveryMode ? (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-[#F97316]/20 border border-[#F97316]/30 rounded-full px-4 py-1 mb-4">
                  <KeyRound className="h-4 w-4 text-[#F97316]" />
                  <span className="text-sm font-medium text-[#F97316]">
                    Redefinir senha
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Crie uma nova senha
                </h1>
                <p className="text-white/70 text-sm md:text-base">
                  Digite e confirme sua nova senha para acessar sua conta
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 md:p-8">
                <ResetPasswordForm
                  formData={form.formData}
                  setFormData={form.setFormData}
                  errors={form.errors}
                  submitting={form.submitting}
                  showPassword={form.showPassword}
                  setShowPassword={form.setShowPassword}
                  showConfirmPassword={form.showConfirmPassword}
                  setShowConfirmPassword={form.setShowConfirmPassword}
                  passwordStrength={form.passwordStrength}
                  onSubmit={form.handleSubmit}
                />

                <div className="mt-6 text-center">
                  <p className="text-sm text-white/60">
                    Lembrou a senha?{" "}
                    <Link
                      to="/login"
                      className="text-[#F97316] hover:underline font-semibold"
                    >
                      Fazer login
                    </Link>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 md:p-8 text-center">
              <div className="mb-6">
                <KeyRound className="w-12 h-12 text-white/50 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">
                  Link de redefinição
                </h2>
                <p className="text-white/70 text-sm">
                  Use o link que enviamos ao seu email para redefinir sua senha.
                  Se você acessou esta página por engano, solicite um novo link.
                </p>
              </div>
              <Link
                to="/esqueceu-senha"
                className="inline-block w-full py-3 rounded-xl border-2 border-white/30 bg-white/5 hover:border-[#F97316]/50 hover:bg-white/10 transition-all text-center font-semibold text-white"
              >
                Solicitar novo link
              </Link>
              <div className="mt-6">
                <Link
                  to="/login"
                  className="text-sm text-[#F97316] hover:underline font-semibold"
                >
                  Voltar para o login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
