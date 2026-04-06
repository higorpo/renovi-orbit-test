# Matriz de cobertura documental

Legenda: **OK** = documentado com evidência direta; **Parcial** = depende de inferência ou RPC/RLS não detalhados linha a linha; **N/A** = não aplicável como feature de produto.

## Por módulo (`src/features`)

| Módulo | Features identificadas | Documentadas | Evidência parcial | Não localizadas / pendentes |
|--------|------------------------|--------------|-------------------|-----------------------------|
| addresses | CRUD endereços; seleção no wizard; CEP; geografia | OK (`gestao-de-enderecos.md`) | Políticas RLS finas por coluna | Página `/dashboard/addresses` (placeholder) |
| auth | Sessão; guards; login/cadastro/recuperação; política de senha | OK (`autenticacao-e-sessao.md`) | Fluxos edge de e-mail Auth em produção | Painel admin no front |
| client-budgets | Lista orçamentos; perguntas; detalhes | OK (`orcamentos-recebidos.md`) | Todas as mensagens RPC | — |
| client-my-services | Lista pedidos; filtros; cancelamento; foco URL | OK (`solicitacoes-do-cliente.md`) | Regras de cancelamento no DB | Detalhe `/dashboard/services/:id` (placeholder) |
| dynamic-form | Schema; steps; validação; demo DEV | OK (`motor-de-formularios.md`) | — | — |
| my-account | Conta cliente/prestador; portfólio; área; exclusão | OK (`minha-conta.md`) | Impacto legal de exclusão de conta | — |
| provider-budgets | Enviados; perguntas; filtros | OK (`orcamentos-enviados.md`) | — | — |
| provider-jobs | Match; detalhe; perguntas; proposta | OK (`trabalhos-e-propostas.md`) | Algoritmo de sort/geo completo no SQL | — |
| provider-profile | Página pública; SEO; URL | OK (`pagina-publica.md`) | — | — |
| request-quote | Wizard completo; IA; convidado; Edge order | OK (`pedir-orcamento.md`) | Rate limit internos | Redirecionamento pós-sucesso (ver pendências) |

## Contagens

| Métrica | Valor |
|---------|-------|
| Pastas em `src/features` (módulos de topo) | 10 |
| READMEs de módulo gerados | 10 |
| Arquivos de feature gerados | 10 |
| Rotas placeholder identificadas | ≥6 |

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
