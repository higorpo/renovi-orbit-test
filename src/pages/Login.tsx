import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";

const REMEMBER_ME_KEY = "renovi_remember_login";

const signInSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export default function Login() {
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn, signInWithGoogle, user, profile, loading, getRedirectPath } =
    useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasRedirected = useRef(false);
  const redirectTo = searchParams.get("redirect");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const savedData = localStorage.getItem(REMEMBER_ME_KEY);
    if (savedData) {
      try {
        const { email } = JSON.parse(savedData);
        if (email) {
          setFormData((prev) => ({ ...prev, email }));
          setRememberMe(true);
        }
      } catch {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (loading || submitting || !user || !profile || hasRedirected.current)
      return;
    if (
      !profile.role ||
      !["client", "provider", "admin"].includes(profile.role)
    )
      return;

    hasRedirected.current = true;
    const redirectPath = redirectTo ?? getRedirectPath(profile);
    navigate(redirectPath, { replace: true });
  }, [user, profile, navigate, loading, submitting, getRedirectPath, redirectTo]);

  const handleGoogleLogin = async () => {
    try {
      setSubmitting(true);
      await signInWithGoogle();
    } catch {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    hasRedirected.current = false;

    try {
      const result = signInSchema.safeParse(formData);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          if (issue.path[0]) {
            fieldErrors[issue.path[0] as string] = issue.message;
          }
        });
        setErrors(fieldErrors);
        setSubmitting(false);
        return;
      }

      if (rememberMe) {
        localStorage.setItem(
          REMEMBER_ME_KEY,
          JSON.stringify({ email: formData.email })
        );
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      await signIn(formData.email, formData.password);
      setTimeout(() => setSubmitting(false), 5000);
    } catch {
      setSubmitting(false);
    }
  };

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
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-white/90 font-medium"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className={`bg-white/10 border-white/30 text-white placeholder:text-white/50 h-12 focus:border-[#C57A3A] focus:ring-[#C57A3A]/20 ${
                    errors.email ? "border-red-400" : ""
                  }`}
                />
                {errors.email && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-white/90 font-medium"
                >
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={`bg-white/10 border-white/30 text-white placeholder:text-white/50 h-12 pr-12 focus:border-[#C57A3A] focus:ring-[#C57A3A]/20 ${
                      errors.password ? "border-red-400" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) =>
                      setRememberMe(checked === true)
                    }
                    className="border-white/40 data-[state=checked]:bg-[#C57A3A] data-[state=checked]:border-[#C57A3A]"
                  />
                  <label
                    htmlFor="remember-me"
                    className="text-sm text-white/70 cursor-pointer select-none hover:text-white/90 transition-colors"
                  >
                    Lembrar-me
                  </label>
                </div>
                <Link
                  to="/forgot-password"
                  className="text-sm text-white/70 hover:text-[#C57A3A] transition-colors font-medium"
                >
                  Esqueceu a senha?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-12 md:h-14 text-base md:text-lg font-semibold bg-[#C57A3A] hover:bg-[#C57A3A]/90 text-white shadow-lg shadow-[#C57A3A]/30"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar na minha conta"
                )}
              </Button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/30 to-white/30" />
              <span className="text-sm text-white/70 font-medium">Ou</span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/30 to-white/30" />
            </div>

            <Button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting}
              variant="outline"
              className="w-full h-12 bg-white hover:bg-gray-50 text-gray-900 border-white/30 font-semibold"
            >
              <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Entrar com Google
            </Button>

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
                <Link
                  to="/juridico/termos-de-uso"
                  className="hover:text-[#C57A3A] transition-colors"
                >
                  Termos de Uso
                </Link>
                <span>•</span>
                <Link
                  to="/juridico/politica-de-privacidade"
                  className="hover:text-[#C57A3A] transition-colors"
                >
                  Privacidade
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
