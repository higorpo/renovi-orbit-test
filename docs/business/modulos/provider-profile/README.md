# Perfil público do prestador (`provider-profile`)

## 1. Leitura para negócio

- **Para que serve:** **vitrine pública** do prestador para visitantes e clientes, com link compartilhável.
- **Quem usa:** visitantes (URL pública); prestador indiretamente (conteúdo vem do cadastro).
- **Processo:** descoberta fora do fluxo logado padrão e reforço de marca pessoal.
- **Valor:** aquisição e confiança.
- **Riscos:** perfil `restricted` ou dados incompletos reduzem conversão — comunicar ao prestador na implantação.

## 2. Visão geral funcional

- **Objetivo:** página `/perfil/:slug` com SEO, serviços, portfólio, área, CTA.
- **Escopo:** leitura via RPC `get_public_provider_by_slug` e dados públicos.
- **Limites:** não edita perfil (edição em `my-account`).
- **Relação:** depende de `provider_profiles_public` e entidades associadas.

## 3. Features

| Feature | Documento |
|---------|-----------|
| Página pública | [features/pagina-publica.md](./features/pagina-publica.md) |

## 4. Perfis

- Público anônimo; prestador como autor do conteúdo.

## 5. Fluxos

- Visitante abre link → vê perfil → CTA para pedido ou contato conforme UI.

## 6. Regras transversais

- `profile_visibility`: `public` vs `restricted` (impacto de exibição — confirmar regras exatas na RPC/policies).

## 7. Entidades

- `provider_profiles_public`, `provider_portfolio_items`, `provider_offered_services`, `provider_service_area_neighborhoods`.

## 8. Integrações

- RPC `get_public_provider_by_slug`; imagens em storage público conforme política.

## 9. Riscos

- **Evidência parcial:** matriz exata do que é omitido em modo `restricted` sem ler SQL completo da RPC.

## 10. Evidências

- `src/features/provider-profile/`
- `supabase/migrations/20260318100007_get_public_provider_by_slug.sql`


## 11. Atualização de auditoria (2026-08-02)

- Revalidado sem drift: `/perfil/:slug`, RPC `get_public_provider_by_slug`, edição fora deste módulo.