# Documentação de negócio — Prestway

Documentação derivada do código da aplicação (front-end React/Vite, Supabase/Postgres, Edge Functions). O objetivo é explicar **como a plataforma se comporta na prática** para times não técnicos, com rastreio às evidências em repositório.

## Como ler esta documentação

1. Comece por [Visão geral da Prestway](./01-visao-geral-da-renovi.md) para contexto de módulos, papéis e jornadas.
2. Use [Mapa de módulos e features](./02-mapa-de-modulos-e-features.md) como índice operacional (rotas, pastas, status de cobertura).
3. Consulte o [Glossário de negócio](./glossario-de-negocio.md) para alinhar termos de domínio.
4. Para acesso e bloqueios, veja [Perfis e permissões](./perfis-e-permissoes.md).
5. Detalhamento por área: pasta `modulos/<nome>/README.md` e, em seguida, `modulos/<nome>/features/*.md`.
6. Lacunas e dúvidas: [Pendências e incertezas](./pendencias-e-incertezas.md).
7. Ligação código ↔ documento: [Rastreabilidade](./rastreabilidade.md).
8. Cobertura: [Matriz de cobertura documental](./matriz-cobertura-documental.md).

## Estrutura de pastas

| Caminho | Conteúdo |
|---------|----------|
| `README.md` (este arquivo) | Índice e orientação |
| `01-visao-geral-da-renovi.md` | Macro da plataforma |
| `02-mapa-de-modulos-e-features.md` | Inventário e rotas |
| `glossario-de-negocio.md` | Termos e siglas |
| `perfis-e-permissoes.md` | Matriz por papel |
| `pendencias-e-incertezas.md` | O que falta comprovar |
| `rastreabilidade.md` | Evidências por artefato |
| `matriz-cobertura-documental.md` | Features vs documentação |
| `modulos/<modulo>/README.md` | Visão do módulo (10 seções padronizadas) |
| `modulos/<modulo>/features/*.md` | Feature com 20 seções padronizadas |

## Módulos documentados (espelho de `src/features`)

| Módulo | Pasta |
|--------|--------|
| Endereços | [modulos/addresses](./modulos/addresses/README.md) |
| Página inicial da aplicação | [modulos/app-home](./modulos/app-home/README.md) |
| Autenticação e sessão | [modulos/auth](./modulos/auth/README.md) |
| Conversas e negociação (CNS) | [modulos/chats](./modulos/chats/README.md) |
| Dashboard — layout e navegação | [modulos/dashboard-shell](./modulos/dashboard-shell/README.md) |
| Beacon de dispositivo | [modulos/device-beacon](./modulos/device-beacon/README.md) |
| Formulários dinâmicos | [modulos/dynamic-form](./modulos/dynamic-form/README.md) |
| Matching progressivo / dispatch | [modulos/matching-dispatch](./modulos/matching-dispatch/README.md) |
| Message Dispatcher (notificações) | [modulos/message-dispatcher](./modulos/message-dispatcher/README.md) |
| Configurações | [modulos/settings](./modulos/settings/README.md) |
| Meus serviços / pedidos (cliente) | [modulos/my-services](./modulos/my-services/README.md) |
| Notifications (engagement de push) | [modulos/notifications](./modulos/notifications/README.md) |
| Pagamentos | [modulos/payments](./modulos/payments/README.md) |
| Calendário do prestador | [modulos/provider-calendar](./modulos/provider-calendar/README.md) |
| Ganhos / liquidações | [modulos/provider-earnings](./modulos/provider-earnings/README.md) |
| Trabalhos e propostas (prestador) | [modulos/provider-jobs](./modulos/provider-jobs/README.md) |
| Credenciamento KYC do prestador | [modulos/provider-kyc](./modulos/provider-kyc/README.md) |
| Perfil público do prestador | [modulos/provider-profile](./modulos/provider-profile/README.md) |
| Permissão de push | [modulos/push-permission](./modulos/push-permission/README.md) |
| Pedir orçamento | [modulos/request-quote](./modulos/request-quote/README.md) |
| Reagendamento de serviço | [modulos/service-reschedule](./modulos/service-reschedule/README.md) |
| Conclusão / enrichment | [modulos/service-completion](./modulos/service-completion/README.md) |
| Visualização de serviços | [modulos/view-services](./modulos/view-services/README.md) |

> **Nota:** a pasta [modulos/client-budgets](./modulos/client-budgets/README.md) existe apenas como registro de módulo **descontinuado** (removido do código); não entra na tabela acima.

## Atualização

Esta documentação deve ser revisada quando houver mudanças em rotas (`src/router.tsx`), regras em migrações Supabase, Edge Functions ou features em `src/features`. A coluna “Evidências” em cada documento aponta os arquivos principais usados na última redação.
