# Página pública do prestador

## 1. Resumo executivo

- **O que é:** página **pública** em **`/perfil/:slug`** que exibe dados do prestador (bio, serviços, portfólio, área de atuação, **reputação/avaliações**, CTA) para visitantes, com preocupação de **SEO**.
- **Problema que resolve:** marketing individual do prestador e confiança antes do pedido.
- **Quem usa:** visitantes; prestador como autor do conteúdo via `my-account`.
- **Resultado esperado:** impressão positiva e clique para **Pedir orçamento** ou contato conforme CTA.

## 2. Objetivo de negócio

- **Finalidade:** aquisição orgânica e compartilhamento de links.
- **Valor:** diferenciação de prestadores (incluindo média e comentários reais de clientes).
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
2. App busca dados via RPC **`get_public_provider_by_slug`** (inclui `rating_avg`, `rating_count`, `completed_services_count` quando elegível).
3. Renderiza seções (header com reputação quando houver avaliações, sobre, serviços, portfólio, área, **avaliações** com paginação por cursor, CTA).
4. CTA leva ao fluxo de pedido ou ação definida no componente (`ProviderProfileCtaBanner`).

## 6. Fluxos alternativos e exceções

- **Slug inexistente:** tratamento de empty/error state (skeleton + mensagem).
- **Imagens:** URLs assinadas ou públicas conforme storage policy.
- **Sem avaliações:** header **não** mostra bloco de média; seção Avaliações com copy **“Ainda sem avaliações”**.

## 7. Regras de negócio

1. Slug único no banco (mecanismo de geração na conta do prestador).
2. Somente dados marcados como públicos entram na vitrine (portfólio `visibility`, etc.).
3. **Média pública:** exibir `rating_avg` (`provider_rating_stats.overall_avg`) **somente** se `rating_count > 0`. Nunca exibir `ranking_quality_score` (score artificial do matching até haver volume mínimo de avaliações).
4. **Lista de comentários:** RPC `list_public_provider_ratings` — itens com nota, comentário (se não vazio), data; rótulo fixo **“Cliente”** (sem PII); mesmo gate de visibilidade do perfil.
5. **Paginação:** cursor composto `(submitted_at, id)` — **não** page/OFFSET; UI “Carregar mais” via `useInfiniteQuery`.

## 8. Campos e dados (exibição)

| Seção | Fonte de dados |
|-------|----------------|
| Cabeçalho | Nome exibido, foto, slug; se `rating_count > 0`: estrelas + média + “N avaliações”; opcionalmente “N serviços concluídos” |
| Sobre | Bio |
| Serviços | `provider_offered_services` + catálogo |
| Portfólio | Itens `public` |
| Área | Bairros/cidade derivados da área de atuação |
| Avaliações | `list_public_provider_ratings` → `ProviderProfileReviews` |

**Labels:** componentes `ProviderProfileAbout`, `ProviderProfileServices`, `ProviderProfileReviews`, etc. Estrelas compartilhadas: `ProviderRatingStars`.

## 9. Validações de front-end

- Parâmetro `slug` na rota.
- SEO: hooks `useProfileSeo` — meta tags.

## 10. Validações de back-end

- RPC com políticas de leitura pública controladas.
- Leitura de agregados/lista de ratings via RPCs `SECURITY DEFINER` (sem SELECT direto de produto em `provider_rating_stats`).

## 11. Status, estados e transições

- **Visibilidade do perfil** alterada na conta → reflete na próxima carga pública (e na lista de ratings pelo mesmo gate).

## 12. Persistência

- Leitura de `provider_profiles_public` e relacionadas; ratings em `service_ratings` / agregados em `provider_rating_stats`; sem escrita nesta feature.

## 13. Integrações

- Compartilhamento social (`useShareProfile`).
- Escrita de rating no fluxo **service-completion** (confirm+rating / submit) alimenta stats e lista pública.

## 14. Listagens, buscas e filtros

- Lista de avaliações: cursor-based (`items` + `next_cursor` + `has_more`); botão “Carregar mais”.
- Demais listagens globais de catálogo: N/A nesta página.

## 15. Ações disponíveis

| Ação | Quem | Resultado |
|------|------|-----------|
| Visualizar | Visitante | Impressão / SEO |
| Compartilhar | Visitante | Link externo |
| Carregar mais avaliações | Visitante | Próxima página por cursor |
| Ir para pedido | Visitante | Sai do perfil para `request-quote` conforme CTA |

## 16. Dependências

- Conteúdo mantido em `my-account`.
- Imagens em storage de portfólio.
- Ratings persistidos por **service-completion** / matching stats.

## 17. Regras implícitas

- `ProviderProfileInlinePreview` reutiliza visual para ambientes internos (consistência de marca).
- Compare de orçamentos reusa `ProviderRatingStars` e summaries de rating (`get_provider_rating_summaries`).

## 18. Riscos

- Perfil restrito mal comunicado ao prestador gera reclamação de “sumiu do Google”.
- Dados desatualizados se prestador não mantém portfólio.
- Perfil sem avaliações pode parecer “menos confiável” mesmo com serviços concluídos — a UI omite média até `rating_count > 0`.

## 19. Evidências

- `src/features/provider-profile/components/ProviderProfilePage.tsx`
- `ProviderProfileHeader`, `ProviderProfileReviews`, `ProviderRatingStars`
- Hooks `useProviderPublicProfile`, `usePublicProviderRatings`, `useProfileSeo`, `useShareProfile`
- API `providerProfilePublic.api.ts`, `providerProfileRatings.api.ts`
- `supabase/migrations/20260318100007_get_public_provider_by_slug.sql` (campos de rating)
- RPCs `get_provider_rating_summaries`, `list_public_provider_ratings`; pgTAP `supabase/tests/matching/provider_rating_read_rpcs_test.sql`

## 20. Pendências

- Descrever campo a campo o retorno público completo da RPC e o comportamento exato em `restricted` (além do gate já auditado).
- Fora de escopo de produto nesta superfície: popup de avaliação pendente no app; UI de editar rating (janela 48h).

## 21. Atualização de auditoria (2026-04-27)

- **Regra de visibilidade confirmada na RPC:** perfil `public` é visível para todos; perfil `restricted` só retorna dados quando `auth.role() = 'authenticated'`; caso contrário retorna `null`.
- **Serviços exibidos no perfil público:** somente serviços `platform_services.active = true` associados ao prestador.
- **Portfólio público:** apenas itens com `provider_portfolio_items.visibility = 'public'` entram na resposta da RPC.
- **Área de atuação pública:** cidade/UF/bairro são agregados por joins de `provider_service_area_neighborhoods`.
- **CTA da página pública:** botão principal sempre leva para `/pedir-orcamento`.

## 22. Atualização de auditoria (2026-08-02)

- Revalidado sem drift.

## 23. Atualização (2026-08-06) — ratings reais na vitrine

- `get_public_provider_by_slug` passa a expor `rating_avg`, `rating_count`, `completed_services_count`.
- Header mostra média/contagem (e serviços concluídos) só com `rating_count > 0`.
- Seção **Avaliações** com `list_public_provider_ratings` (cursor) e empty “Ainda sem avaliações”.
- Sem PII do cliente na lista (rótulo “Cliente”).
