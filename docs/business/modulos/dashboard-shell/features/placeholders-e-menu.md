# Dashboard — layout, menu e páginas placeholder

## 1. Visão geral

- **Objetivo do módulo:** fornecer o **shell** do painel (`DashboardLayout`) com header (desktop), navegação inferior (mobile) e conteúdo via `<Outlet />`.
- **Contexto de negócio:** após autenticação, cliente e prestador acessam funções de pedidos, orçamentos e conta; parte das rotas ainda não tem implementação além do título.
- **Perfis envolvidos:** `client` e `provider` (derivado de `useAuth().profile.role`); itens de menu diferem por papel.
- **Dependências com outros módulos:** renderiza **páginas reais** importadas no router (`my-account`, `my-services`, `provider-jobs`, etc.); placeholders **não** importam features de negócio.

---

## 2. Telas e rotas

| Tela | Rota | Objetivo | Perfis com acesso |
|------|------|----------|-------------------|
| Shell (sem título próprio) | `/dashboard/*` | Layout + nav | `client`, `provider` (pai) |
| Visão geral (placeholder) | `/dashboard` | Marcador de posição | `client`, `provider` |
| Endereços (placeholder) | `/dashboard/addresses` | Marcador; **não** usa feature `addresses` | Somente `client` (guard aninhado) |
| Configurações (placeholder) | `/dashboard/settings` | Marcador | `client`, `provider` |
| Ajuda (placeholder) | `/dashboard/help` | Marcador | `client`, `provider` |
| Ganhos (placeholder) | `/dashboard/earnings` | Marcador | Somente `provider` (guard aninhado) |

**Evidência:** `src/router.tsx` (rotas filhas de `dashboard` com `DashboardFakePage`); `DashboardFakePage.tsx`.

**Menu lateral / bottom nav:** `src/layouts/DashboardLayout/dashboardMenu.ts` — `getDashboardMenu(role)` retorna labels e paths; cliente inclui `Visão geral`, `Meus Serviços`, `Conversas`, `Endereços`, `Minha conta`, `Ajuda`; prestador inclui `Visão geral`, `Meus Serviços`, `Trabalhos`, `Orçamentos`, `Conversas`, `Ganhos`, `Minha conta`, `Ajuda`.

**Filtro KYC (prestador):** se a conta NetCred estiver ausente ou `onboarding_status !== ACTIVE` (incl. loading), `useProviderKycNavItems` deixa **somente Minha conta** no menu desktop e bottom nav. Detalhe: [gate-e-acesso-operacional](../../provider-kyc/features/gate-e-acesso-operacional.md).

---

## 3. Ações disponíveis

| Ação | Onde aparece | Quem pode executar | Regras | Efeitos |
|------|--------------|--------------------|--------|---------|
| Navegar pelo menu | Header (desktop) / bottom nav (mobile) | Conforme itens do menu para o papel | Requer sessão válida no layout protegido; prestador sem KYC `ACTIVE` só vê Minha conta | `react-router` navegação |
| Ver título da página placeholder | Dentro do `Card` | Mesmo do guard da rota | Prestador bloqueado por KYC: outlet operacional substituído pelas telas do gate (exceto `/dashboard/conta*`) | Exibe título + texto “Página em construção.” (quando o outlet real chega ao placeholder) |

**Evidência:** `DashboardLayout.tsx`, `DesktopNav.tsx`, `MobileNav.tsx`, `DashboardFakePage.tsx`, `useProviderKycNavItems`.

---

## 4. Campos por tela

Placeholder **não possui** formulários, filtros nem campos de entrada.

---

## 5. Botões e comportamentos

### Páginas `DashboardFakePage`

| Botão/Ação | Comportamento | Validações prévias | Permissão | Resultado |
|------------|---------------|--------------------|-----------|-----------|
| — | — | — | — | Nenhum botão de ação no componente |

**Evidência:** `DashboardFakePage.tsx` (apenas `Card` + título + parágrafo).

---

## 6. Regras de negócio

- Título exibido: prop `title` **ou** `titleByRole[profile.role]` **ou** fallback `"Dashboard"` — `profile?.role ?? "client"` quando necessário.
- Rotas placeholder **não** aplicam regras de domínio (pedido, orçamento, etc.).
- **Prestador:** `ProviderKycGate` envolve slots persistentes do prestador + outlet; bloqueia conteúdo operacional até `ACTIVE`, com exceção de `/dashboard/conta*`. Slot de Meus serviços do **cliente** fica fora do gate.

**Evidência:** `DashboardFakePage.tsx` linhas 15–21; `DashboardLayout.tsx`; [provider-kyc](../../provider-kyc/README.md).

---

## 7. Perfis e permissões

| Perfil | Visualizar placeholders gerais | `/dashboard/addresses` | `/dashboard/earnings` |
|--------|--------------------------------|-------------------------|------------------------|
| client | Sim (onde router permitir) | Sim | Não (rota com `allowedRoles={['provider']}`) |
| provider | Sim (onde router permitir) | Não | Sim |

**Evidência:** `src/router.tsx`.

---

## 8. Tabelas, entidades e dados envolvidos

Nenhuma persistência ou query no layout/placeholder além de leitura de `profile` para menu e título.

**Evidência:** `useAuth()` em `DashboardLayout.tsx` e `DashboardFakePage.tsx`.

---

## 9. APIs, serviços e fluxos técnicos

| Camada | Nome | Responsabilidade | Arquivo/Caminho |
|--------|------|------------------|-----------------|
| UI | `DashboardLayout` | Shell + offline banner implícito (`useOnlineStatus`); gate KYC + filtro de menu do prestador | `layouts/DashboardLayout/DashboardLayout.tsx` |
| Config | `getDashboardMenu` | Itens por papel | `layouts/DashboardLayout/dashboardMenu.ts` |
| Feature | `ProviderKycGate` / `useProviderKycNavItems` | Bloqueio operacional e menu só Minha conta | `src/features/provider-kyc/` |
| UI | `DashboardFakePage` | Placeholder | `layouts/DashboardLayout/DashboardFakePage.tsx` |
| Roteamento | `createBrowserRouter` | Árvore de rotas | `src/router.tsx` |

---

## 10. Fluxos operacionais

### Fluxo principal

1. Usuário autenticado entra em uma rota `/dashboard/...`.
2. `DashboardLayout` monta menu conforme `profile.role` (e, se prestador sem KYC `ACTIVE`, reduz a Minha conta).
3. Para prestador, `ProviderKycGate` libera outlet/slots só se `ACTIVE` ou path `/dashboard/conta*`; caso contrário mostra telas de status/formulário KYC.
4. `Outlet` (quando liberado) renderiza a página filha (real ou `DashboardFakePage`).

### Fluxos alternativos

1. **Offline:** layout ajusta posição do header quando `!isOnline` (`top-11` vs `top-0`) — `DashboardLayout.tsx`.
2. **Prestador suspenso / rejeitado / em análise:** conteúdo operacional substituído pelas UIs de status do módulo [provider-kyc](../../provider-kyc/features/gate-e-acesso-operacional.md).

---

## 11. Mensagens do sistema

| Tipo | Mensagem | Quando ocorre |
|------|----------|----------------|
| UI fixa | “Página em construção.” | Qualquer rota que usa `DashboardFakePage` |
| Loading guest guard | “Carregando...” | Não é deste módulo; está em `GuestOnlyRoute` |

---

## 12. Evidências no código

- `src/router.tsx` — definição de `dashboard` e filhos com `DashboardFakePage`.
- `src/layouts/DashboardLayout/DashboardFakePage.tsx` — texto e lógica de título.
- `src/layouts/DashboardLayout/dashboardMenu.ts` — itens do menu cliente vs prestador.

---

## 13. Lacunas ou pontos não confirmados

| Item | Status | Observação |
|------|--------|------------|
| Conteúdo futuro de `/dashboard/settings`, `/dashboard/help` | Não localizado | Apenas placeholder no código analisado |
| Por que `/dashboard/addresses` não renderiza `AddressesSection` | Decisão de produto | Não explicitada em comentário no router; comportamento apenas inferido pela escolha de componente |

## 14. Atualização de auditoria (2026-04-27)

- **Rota mãe protegida:** todo `/dashboard/*` exige auth com papel `client` ou `provider`.
- **Subguards por rota placeholder:** `/dashboard/addresses` é cliente-only e `/dashboard/earnings` provider-only.
- **Menu é derivado de papel em runtime:** `getDashboardMenu(role)` controla itens desktop/mobile do shell.
- **Comportamento offline no layout:** header ajusta offset quando `useOnlineStatus` indica ausência de conexão.

## 15. Atualização (2026-07-30) — gate KYC no shell

- Prestador sem onboarding `ACTIVE`: shell operacional bloqueado; nav só **Minha conta**; `/dashboard/conta*` permanece acessível.
- `ProviderKycGate` envolve slots persistentes do prestador + outlet; slot de Meus serviços do cliente fica fora.
- Doc canônico: [gate-e-acesso-operacional](../../provider-kyc/features/gate-e-acesso-operacional.md).
