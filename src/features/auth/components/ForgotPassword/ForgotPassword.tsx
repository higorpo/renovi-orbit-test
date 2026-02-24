import { Link } from "react-router";
import { useForgotPasswordForm } from "../../hooks/useForgotPasswordForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { ForgotPasswordSuccess } from "./ForgotPasswordSuccess";

export default function ForgotPassword() {
  const form = useForgotPasswordForm();

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

          {form.sent ? (
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 md:p-8">
              <ForgotPasswordSuccess />
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Esqueceu sua senha?
                </h1>
                <p className="text-white/70 text-sm md:text-base">
                  Digite seu email para receber um link de redefinição
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 md:p-8">
                <ForgotPasswordForm
                  formData={form.formData}
                  setFormData={form.setFormData}
                  errors={form.errors}
                  submitting={form.submitting}
                  onSubmit={form.handleSubmit}
                />

                <div className="mt-6 text-center">
                  <p className="text-sm text-white/60">
                    Lembrou sua senha?{" "}
                    <Link
                      to="/login"
                      className="text-[#C57A3A] hover:underline font-semibold"
                    >
                      Faça login
                    </Link>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
