# Matriz de cobertura documental

Última auditoria completa: **2026-05-26** (revisão: adição do módulo Message Dispatcher com feature de horário silencioso).

Legenda: **OK** = documentado com evidência direta; **Parcial** = depende de inferência ou RPC/RLS não detalhados linha a linha; **N/A** = não aplicável como feature de produto.

## Por módulo (`src/features`)

| Módulo | Features identificadas | Documentadas | Evidência parcial | Não localizadas / pendentes |
|--------|------------------------|--------------|-------------------|-----------------------------|
| addresses | CRUD endereços; seleção no wizard; CEP; geografia | OK (`gestao-de-enderecos.md`) | — | Página `/dashboard/addresses` (placeholder) |
| auth | Sessão; guards; login/cadastro/recuperação; política de senha | OK (`autenticacao-e-sessao.md`) | Fluxos edge de e-mail Auth em produção | Painel admin no front |
| client-budgets | Lista orçamentos; perguntas; detalhes | OK (`orcamentos-recebidos.md`) | Mapa exaustivo de mensagens SQL por código/errcode | — |
| client-my-services | Lista paginada; abas open/propostas; busca ILIKE; filtros join; deep link; sheets | OK (`solicitacoes-do-cliente.md`) | RLS/policies finas no update cancel | Placeholder `/dashboard/services/:id`; sheet detalhe só `open`; dropdowns só da página carregada |
| dynamic-form | Schema; steps; validação; demo DEV | OK (`motor-de-formularios.md`) | — | — |
| my-account | Conta cliente/prestador; portfólio; área; exclusão | OK (`minha-conta.md`) | Impacto legal de exclusão de conta | — |
| provider-budgets | Enviados; perguntas; filtros; paginação; busca; integração detalhe `provider-jobs` | OK (`orcamentos-enviados.md`) | Filtro `closed` em perguntas existe só na RPC (sem chip na UI) | — |
| provider-jobs | Match; detalhe; perguntas; proposta | OK (`trabalhos-e-propostas.md`) | Algoritmo de sort/geo completo no SQL | — |
| provider-profile | Página pública; SEO; URL | OK (`pagina-publica.md`) | — | — |
| request-quote | Wizard 4/5 passos; IA automática passo 3; rascunho local; multipart Edge; reCAPTCHA; nsfwjs | OK (`pedir-orcamento.md`) | Validação server-side fina do form na Edge | P-01 redirect `/dashboard/client`; mismatch 10 MB front / 5 MB Edge fotos |

## Módulos fora de `src/features` (documentados em `modulos/`)

| Módulo | Escopo | Documento |
|--------|--------|-----------|
| dashboard-shell | `DashboardLayout`, menu, `DashboardFakePage`, rotas placeholder do dashboard | `modulos/dashboard-shell/` |
| app-home | Rota index `/`, componente `App` | `modulos/app-home/` |
| message-dispatcher | Notificações multicanal (backend); FSM, quotas, horário silencioso, checkout, reconciliação | `modulos/message-dispatcher/` |

## Contagens

| Métrica | Valor |
|---------|-------|
| Pastas em `src/features` (módulos de topo) | 10 |
| Módulos adicionais documentados (shell + home + backend) | 3 |
| **Total módulos no índice** `modulos/README.md` | **13** |
| READMEs de módulo em `docs/business/modulos/` | 13 |
| Arquivos de feature em `modulos/*/features/` | 13+ |
| Rotas placeholder identificadas | ≥6 |
| Cobertura documental (critério do índice) | **100%** dos 13 módulos |

## Features globais fora de `src/features`

| Item | Status |
|------|--------|
| PWA / Service worker (`src/sw.ts`) | Não documentado em profundidade |
| App nativo Capacitor (Android) | **Parcial** — shell + persistência Preferences documentados abaixo; `device-beacon` / `push-permission` só na rastreabilidade; sem módulo em `modulos/` |
| Observabilidade (Sentry) | Mencionado na rastreabilidade |
| Analytics (`useAnalytics`) | Mencionado pontualmente em fluxos críticos |
| Message Dispatcher (backend) | **Parcial** — README do módulo + feature quiet hours documentados; features de quota, checkout, reconciliação e engagement cobertas na visão geral mas sem feature doc dedicada |

### App nativo Capacitor (evidência verificada)

| Comportamento | Onde |
|---------------|------|
| Inicialização no boot da SPA | `src/main.tsx` → `initCapacitorPlugins()` |
| SystemBars estilo escuro em plataforma nativa | `initCapacitorPlugins.ts` + `capacitor.config.ts` (`insetsHandling: css`, `style: DARK`) — API de `@capacitor/core`, não `@capacitor/status-bar` |
| Splash exibido no launch e ocultado pela app (`launchAutoHide: false`) | `SplashScreen.hide()` após init |
| Safe area superior no layout global | `src/index.css` (`--safe-area-inset-top`) |
| Teclado virtual: variável CSS `--keyboard-height` no `html` | listeners `keyboardWillShow` / `keyboardWillHide` |
| Android: botão voltar navega `history.back()` ou encerra app | listener `App.backButton` |
| Ciclo de vida: `document.documentElement.dataset.appActive` | listener `App.appStateChange` |
| Persistência cliente (Preferences) | **OK (transversal)** — ver tabela abaixo; documentado em auth, request-quote, rastreabilidade |
| Haptics | Pacote em `package.json`; **sem uso** em `src/` |

### Persistência em Capacitor Preferences (evidência verificada)

| Chave lógica | Consumidor | Documentado em |
|--------------|------------|----------------|
| `sb-{ref}-auth-token` | Supabase Auth (`createSupabaseAuthStorage`) | `auth` — autenticacao-e-sessao |
| `orbit_persist_session` | Manter conectado | `auth` — autenticacao-e-sessao |
| `orbit.cache.persist.v1:*` | `cachePersist*` (`src/lib/cache.ts`) | rastreabilidade |
| `renovi_request_quote_draft` | Rascunho do wizard | `request-quote` — pedir-orcamento |
| `orbit_device_beacon_last_sync_v1` | `device-beacon` / `syncSchedule.ts` | rastreabilidade (**sem** `modulos/device-beacon/`) |
| `orbit_push_permission_prompt_dismissed_at` | `push-permission` / cooldown do dialog | rastreabilidade (**sem** `modulos/push-permission/`) |

| Comportamento transversal | Onde |
|---------------------------|------|
| Web / E2E: prefixo `CapacitorStorage.` no `localStorage` | `PREFERENCES_WEB_KEY_PREFIX`, `e2e/fixtures/auth.fixture.ts` |

## Próximas expansões sugeridas (fora do escopo mínimo cumprido)

- Documento dedicado a **RLS por tabela** para auditoria de segurança.
- Documento de **operacionalização** (cron, jobs `expire_stale_provider_proposals`).
- Documento de **admin** caso rotas sejam adicionadas.
