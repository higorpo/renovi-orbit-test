# Matriz de cobertura documental

Última auditoria completa: **2026-04-27**.

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

## Contagens

| Métrica | Valor |
|---------|-------|
| Pastas em `src/features` (módulos de topo) | 10 |
| Módulos adicionais documentados (shell + home) | 2 |
| **Total módulos no índice** `modulos/README.md` | **12** |
| READMEs de módulo em `docs/business/modulos/` | 12 |
| Arquivos de feature em `modulos/*/features/` | 12+ |
| Rotas placeholder identificadas | ≥6 |
| Cobertura documental (critério do índice) | **100%** dos 12 módulos |

## Features globais fora de `src/features`

| Item | Status |
|------|--------|
| PWA / Service worker (`src/sw.ts`) | Não documentado em profundidade |
| Observabilidade (Sentry) | Mencionado na rastreabilidade |
| Analytics (`useAnalytics`) | Mencionado pontualmente em fluxos críticos |

## Próximas expansões sugeridas (fora do escopo mínimo cumprido)

- Documento dedicado a **RLS por tabela** para auditoria de segurança.
- Documento de **operacionalização** (cron, jobs `expire_stale_provider_proposals`).
- Documento de **admin** caso rotas sejam adicionadas.
