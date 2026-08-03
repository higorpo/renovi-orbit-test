# Página inicial da aplicação (`app-home`)

## 1. Leitura para negócio

- **Para que serve:** rota raiz **`/`** da SPA — tela **mínima** (marca “Renovi” + botão para login).
- **Quem usa:** qualquer visitante (e também usuários autenticados que abrirem `/` ou aterrem após logout).
- **Contexto:** não há pasta `src/features/app-home/`; o módulo documental cobre `src/App.tsx` registrado como index em `src/router.tsx`, sob `RootLayout`.
- **Não inventar expectativa:** não é landing de marketing, catálogo nem “home logada”; pós-login autenticado vai para `/dashboard` (auth), não para esta tela — esta tela **é** o destino típico pós-**logout**.

## 2. Visão geral funcional

1. Bootstrap (`main.tsx`: Capacitor plugins → preferência de sessão → `RouterProvider`).
2. Router resolve child `index: true` → lazy `App`.
3. UI estática + `navigate('/login')` no botão.
4. Sem consulta a sessão, API, formulário ou persistência própria.

## 3. Features do módulo

| Feature | Documento |
|---------|-----------|
| Página inicial (`/`) | [features/pagina-inicial.md](./features/pagina-inicial.md) |

## 4. Perfis envolvidos

| Perfil | Papel na home |
|--------|----------------|
| Anônimo | Público; CTA para `/login` |
| `client` / `provider` | Podem ver `/` (sem auto-redirect); aterrissam em `/` após logout |
| Outros | Mesma UI pública |

## 5. Principais fluxos

1. Abrir origem → home → Login → `/login`.
2. Logout OK → `navigate("/", { replace: true })` → home.
3. Recovery de erro / logos em outras telas → `/`.

Detalhe e mermaid: [pagina-inicial.md](./features/pagina-inicial.md).

## 6. Regras transversais

- Rota **pública** (sem `ProtectedRoute` / `GuestOnlyRoute` na index).
- **Sem** regra de redirect por sessão na própria home.
- Shell Capacitor/PWA/auth hosts vivem no `RootLayout`, não em `App`.

## 7. Entidades

Nenhuma entidade de domínio. Sem tabelas, drafts ou Preferences keys próprias.

## 8. Integrações

| Peça | Relação |
|------|---------|
| **auth** | Destino de logout; CTA para login; home não importa a feature |
| **Capacitor** | Entry do WebView / splash no layout pai; config em `capacitor.config.ts` |
| **Error boundaries** | “Voltar ao início” → `/` |
| Outros módulos | Apenas links de logo/navegação de volta para `/` |

## 9. Riscos e lacunas

| Item | Status |
|------|--------|
| Landing / produto rico em `/` | Não implementado (home mínima) |
| Auto-redirect autenticado em `/` | Ausente |
| `server.url` LAN no Capacitor | Marcado como temporário no config |
| Feature folder `src/features/app-home` | Não existe |

## 10. Evidências

- `src/App.tsx`
- `src/App.css`
- `src/router.tsx` (`index: true` → `<App />`)
- `src/main.tsx`
- `src/layouts/RootLayout.tsx`
- `capacitor.config.ts`
- `index.html`
- Feature doc: [features/pagina-inicial.md](./features/pagina-inicial.md)
