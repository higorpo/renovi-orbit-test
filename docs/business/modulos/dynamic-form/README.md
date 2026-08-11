# Formulários dinâmicos (`dynamic-form`)

## 1. Leitura para negócio

- **Para que serve:** renderizar **formulários configuráveis** (por serviço) sem deploy de código novo para cada mudança de perguntas.
- **Quem usa:** cliente no fluxo de pedido; equipe interna via dados em `platform_forms` (gestão fora do escopo deste front).
- **Processo:** coleta estruturada de requisitos do serviço antes da descrição/fotos.
- **Valor:** flexibilidade comercial e operacional.
- **Riscos:** schemas inválidos ou versões desalinhadas podem quebrar o wizard — exige governança de formulário.

## 2. Visão geral funcional

- **Objetivo:** motor multi-etapa: blocos, visibilidade condicional, validação, progresso, resumo.
- **Escopo:** puramente front (sem pasta `api` dedicada).
- **Limites:** não persiste sozinho — quem persiste é o fluxo de pedido.
- **Relação:** `request-quote` consome schemas obtidos via APIs de serviço/formulário; `view-services` consome `buildSummaryEntries` / `SummaryEntry` (com `type`) para **Informações do pedido** no detalhe.

## 3. Features

| Feature | Documento |
|---------|-----------|
| Motor de formulários | [features/motor-de-formularios.md](./features/motor-de-formularios.md) |

## 4. Perfis

- Qualquer usuário no passo correspondente do pedido; demo técnica em DEV.

## 5. Fluxos

- Carregar schema → renderizar etapas → validar → expor dados ao container pai.

## 6. Regras transversais

- `form_status` em `platform_forms`: `draft`, `active`, `deprecated`.

## 7. Entidades

- `platform_forms`, JSON de schema (versão).

## 8. Integrações

- Indireta: prompts de IA podem usar dados do formulário na geração de descrição.

## 9. Riscos

- Regras de visibilidade complexas exigem testes por serviço.

## 10. Evidências

- `src/features/dynamic-form/`
- `supabase/migrations/20260226100000_create_forms.sql`


## 11. Atualização de auditoria (2026-08-02)

- Revalidado sem drift no README; rota DEV da demo corrigida no feature (`/dev/demo/form`).