import { Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useOAuthErrorFromUrl } from "./useOAuthErrorFromUrl";
import { useLoginForm } from "./useLoginForm";
import { LoginForm } from "./LoginForm";

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();

  const form = useLoginForm({
    signIn,
    signInWithGoogle,
  });

  useOAuthErrorFromUrl();

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/hero-client.jpg)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F2F3A]/95 via-[#0F2F3A]/90 to-black/80" />
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

          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Bem-vindo de volta
            </h1>
            <p className="text-white/70 text-sm md:text-base">
              Acesse sua conta para gerenciar seus serviços
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 md:p-8">
            <LoginForm
              formData={form.formData}
              setFormData={form.setFormData}
              errors={form.errors}
              submitting={form.submitting}
              showPassword={form.showPassword}
              setShowPassword={form.setShowPassword}
              rememberMe={form.rememberMe}
              setRememberMe={form.setRememberMe}
              onSubmit={form.handleSubmit}
            />

            <div className="mt-8 text-center space-y-4">
              <p className="text-white/70 text-sm">Não tem uma conta?</p>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/cadastro/cliente"
                  className="py-3 px-4 rounded-xl border-2 border-white/30 bg-white/5 hover:border-[#C57A3A]/50 hover:bg-white/10 transition-all text-center flex flex-col items-center justify-center"
                >
                  <p className="font-semibold text-sm text-white">Sou Cliente</p>
                  <p className="text-xs text-white/60">Quero contratar</p>
                </Link>
                <Link
                  to="/cadastro/profissional"
                  className="py-3 px-4 rounded-xl border-2 border-white/30 bg-white/5 hover:border-[#C57A3A]/50 hover:bg-white/10 transition-all text-center"
                >
                  <p className="font-semibold text-sm text-white">
                    Sou Profissional
                  </p>
                  <p className="text-xs text-white/60">Quero trabalhar</p>
                </Link>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/20">
              <div className="flex items-center justify-center gap-6 text-xs text-white/50 mb-4">
                <span className="flex items-center gap-1">
                  <span className="text-[#C57A3A]">✓</span> Seguro
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-[#C57A3A]">✓</span> Verificado
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-[#C57A3A]">✓</span> Confiável
                </span>
              </div>
              <div className="flex items-center justify-center gap-3 text-xs text-white/50 flex-wrap">
                <a
                  href={`${(import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "")}/juridico/termos-de-uso`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#C57A3A] transition-colors"
                >
                  Termos de Uso
                </a>
                <span>•</span>
                <a
                  href={`${(import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "")}/juridico/politica-de-privacidade`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#C57A3A] transition-colors"
                >
                  Privacidade
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
