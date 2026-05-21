# Autenticação (`auth`)

## 1. Leitura para negócio

- **Para que serve:** identificar usuários, manter sessão e aplicar **quem pode ver cada área** da aplicação.
- **Quem usa:** todos os perfis; visitantes em telas públicas e de cadastro.
- **Processo suportado:** entrada na plataforma, recuperação de senha, base para RLS no Supabase (`auth.uid()`).
- **Valor:** segurança e continuidade da jornada (pedido → painel).
- **Riscos operacionais:** redirecionamentos para rotas não declaradas (`/admin/dashboard`, `/onboarding`) — ver pendências.

## 2. Visão geral funcional

- **Objetivo:** Supabase Auth + perfil em `profiles`.
- **Escopo:** login, cadastro cliente/profissional, esqueci senha, reset, guards, política de senha, reCAPTCHA no cadastro.
- **Limites:** não inclui SSO corporativo mapeado neste tree.
- **Relação:** pré-requisito para dashboard e operações de prestador/cliente.

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Autenticação e sessão | Sessão, perfil, guards, fluxos de entrada | [features/autenticacao-e-sessao.md](./features/autenticacao-e-sessao.md) |

## 4. Perfis envolvidos

- **Visitante:** cadastro e login.
- **Cliente / Prestador:** sessão completa.
- **Admin:** no modelo de dados; UI de admin **não** mapeada no router.

## 5. Principais fluxos

- Cadastro → confirmação de e-mail (Auth) → perfil criado por trigger.
- Login → redirect por `role`; opção **Manter conectado** define se a sessão Supabase persiste em Capacitor Preferences ou só em memória.
- Recuperação de senha por e-mail.
- No boot da app: hidratação da preferência de sessão (`orbit_persist_session`) antes da UI.

## 6. Regras transversais

- Papéis permitidos no banco: `client`, `provider`, `admin`.
- App restringe promoção a `admin` e certas mudanças de papel via triggers/API.

## 7. Entidades

- `auth.users` (Supabase)
- `profiles`

## 8. Integrações

- **Google reCAPTCHA v3** no cadastro (`verify-recaptcha`).
- E-mail via **Supabase Auth** (Inbucket local / SMTP comentado para Resend).

## 9. Riscos e lacunas

- Destinos de redirect inconsistentes com rotas declaradas.

## 10. Evidências

- `src/features/auth/`
- `src/lib/capacitor/preferencesStorage.ts`, `src/lib/persistSession.ts`, `src/lib/supabase/client.ts`
- `src/main.tsx` (bootstrap de sessão)
- `supabase/migrations/20260223100000_create_public_profiles.sql`
- `supabase/migrations/20260224140000_restrict_role_admin_security.sql`
- `src/router.tsx`
