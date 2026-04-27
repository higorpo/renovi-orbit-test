# Página pública do prestador

## 1. Resumo executivo

- **O que é:** página **pública** em **`/perfil/:slug`** que exibe dados do prestador (bio, serviços, portfólio, área de atuação, CTA) para visitantes, com preocupação de **SEO**.
- **Problema que resolve:** marketing individual do prestador e confiança antes do pedido.
- **Quem usa:** visitantes; prestador como autor do conteúdo via `my-account`.
- **Resultado esperado:** impressão positiva e clique para **Pedir orçamento** ou contato conforme CTA.

## 2. Objetivo de negócio

- **Finalidade:** aquisição orgânica e compartilhamento de links.
- **Valor:** diferenciação de prestadores.
- **Impacto:** pode aumentar volume de pedidos direcionados.
- **Contexto:** fora do dashboard autenticado.

## 3. Localização na plataforma

| Rota | Componente |
|------|------------|
| `/perfil/:slug` | `ProviderProfilePage` |

Helpers: `getProviderProfilePath`, `buildProfileUrl` (`provider-profile`).

## 4. Perfis envolvidos

- **Visitante:** leitura.
- **Prestador:** não edita nesta rota — edita em Minha conta.
- **Cliente logado:** pode usar como referência sem barreira.

**Visibilidade:** respeitar `profile_visibility` (`public` / `restricted`) — **detalhe de o que muda na UI: evidência parcial sem leitura completa da RPC**.

## 5. Fluxo funcional principal

1. Visitante acessa URL com slug.
2. App busca dados via RPC **`get_public_provider_by_slug`**.
3. Renderiza seções (header, sobre, serviços, portfólio, área).
4. CTA leva ao fluxo de pedido ou ação definida no componente (`ProviderProfileCtaBanner`).

## 6. Fluxos alternativos e exceções

- **Slug inexistente:** tratamento de empty/error state (skeleton + mensagem).
- **Imagens:** URLs assinadas ou públicas conforme storage policy.

## 7. Regras de negócio

1. Slug único no banco (mecanismo de geração na conta do prestador).
2. Somente dados marcados como públicos entram na vitrine (portfólio `visibility`, etc.).

## 8. Campos e dados (exibição)

| Seção | Fonte de dados |
|-------|----------------|
| Cabeçalho | Nome exibido, foto, slug |
| Sobre | Bio |
| Serviços | `provider_offered_services` + catálogo |
| Portfólio | Itens `public` |
| Área | Bairros/cidade derivados da área de atuação |

**Labels:** componentes `ProviderProfileAbout`, `ProviderProfileServices`, etc.

## 9. Validações de front-end

- Parâmetro `slug` na rota.
- SEO: hooks `useProfileSeo` — meta tags.

## 10. Validações de back-end

- RPC com políticas de leitura pública controladas.

## 11. Status, estados e transições

- **Visibilidade do perfil** alterada na conta → reflete na próxima carga pública.

## 12. Persistência

- Leitura de `provider_profiles_public` e relacionadas; sem escrita nesta feature.

## 13. Integrações

- Compartilhamento social (`useShareProfile`).

## 14. Listagens, buscas e filtros

- N/A na página pública (catálogo global é outro fluxo).

## 15. Ações disponíveis

| Ação | Quem | Resultado |
|------|------|-----------|
| Visualizar | Visitante | Impressão / SEO |
| Compartilhar | Visitante | Link externo |
| Ir para pedido | Visitante | Sai do perfil para `request-quote` conforme CTA |

## 16. Dependências

- Conteúdo mantido em `my-account`.
- Imagens em storage de portfólio.

## 17. Regras implícitas

- `ProviderProfileInlinePreview` reutiliza visual para ambientes internos (consistência de marca).

## 18. Riscos

- Perfil restrito mal comunicado ao prestador gera reclamação de “sumiu do Google”.
- Dados desatualizados se prestador não mantém portfólio.

## 19. Evidências

- `src/features/provider-profile/components/ProviderProfilePage.tsx`
- Hooks `useProviderPublicProfile`, `useProfileSeo`, `useShareProfile`
- `supabase/migrations/20260318100007_get_public_provider_by_slug.sql`

## 20. Pendências

- Descrever campo a campo o retorno público da RPC e o comportamento exato em `restricted`.

## 21. Atualização de auditoria (2026-04-27)

- **Regra de visibilidade confirmada na RPC:** perfil `public` é visível para todos; perfil `restricted` só retorna dados quando `auth.role() = 'authenticated'`; caso contrário retorna `null`.
- **Serviços exibidos no perfil público:** somente serviços `platform_services.active = true` associados ao prestador.
- **Portfólio público:** apenas itens com `provider_portfolio_items.visibility = 'public'` entram na resposta da RPC.
- **Área de atuação pública:** cidade/UF/bairro são agregados por joins de `provider_service_area_neighborhoods`.
- **CTA da página pública:** botão principal sempre leva para `/pedir-orcamento`.
