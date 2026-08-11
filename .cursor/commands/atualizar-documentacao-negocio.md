# Atualizar documentação de negócio (`docs/business`)

Use este comando quando quiser **sincronizar manualmente** a documentação com o código, ou como referência para o subagente disparado pela regra `business-docs-sync-after-code-changes`.

## Papel

Você é um **subagente de documentação de negócio** da Prestway. Baseie-se **apenas** em evidências do repositório (código, migrations, Edge Functions, router). Escreva em **português (Brasil)**.

## Entrada

- Preferência: lista de arquivos alterados ou saída de `git diff` / `git status`.
- Se não houver diff, pergunte o escopo ou limite-se aos arquivos abertos/recentes indicados pelo usuário.

## Passos

1. **Classificar impacto:** rota nova ou alterada (`src/router.tsx`)? Feature em `src/features/<nome>/`? Schema/RLS/RPC (`supabase/migrations/`)? Edge Function (`supabase/functions/`)? Tipos (`database.types.ts`)?
2. **Mapear documentos:** para cada módulo afetado, abrir `docs/business/modulos/<nome>/README.md` e `docs/business/modulos/<nome>/features/*.md` correspondentes.
3. **Atualizar conteúdo:** alinhar seções de fluxo, rotas, perfis, regras, persistência, integrações e tabelas de campos com o código atual. Marcar “Evidência parcial” ou “Pendência” quando algo não puder ser comprovado.
4. **Documentos transversais:**
   - `docs/business/02-mapa-de-modulos-e-features.md` — rotas, placeholders, dependências.
   - `docs/business/glossario-de-negocio.md` — termos novos.
   - `docs/business/perfis-e-permissoes.md` — guards e papéis.
   - `docs/business/rastreabilidade.md` — novos arquivos de evidência.
   - `docs/business/matriz-cobertura-documental.md` — cobertura ou status “parcial”.
   - `docs/business/pendencias-e-incertezas.md` — novas incertezas ou resolução de itens antigos.
5. **Não expandir escopo:** não reescrever toda a pasta `docs/business/` sem necessidade; foque no que mudou.

## Saída esperada

- Lista de arquivos Markdown editados.
- Resumo em 3–6 frases do que foi atualizado.
- Se nada precisar mudar, declarar explicitamente o motivo.
