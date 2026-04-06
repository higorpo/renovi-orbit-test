# Endereços (`addresses`)

## 1. Leitura para negócio

- **Para que serve:** permitir que o **cliente** cadastre, edite e escolha endereços com estado, cidade e bairro alinhados ao cadastro geográfico da plataforma; suportar fluxos que precisam de localização (ex.: pedido de orçamento).
- **Quem usa:** principalmente **clientes** autenticados; componentes reutilizados no wizard público quando há usuário logado.
- **Processo suportado:** captação de local do serviço e consistência com `client_addresses` e tabelas de plataforma.
- **Valor:** reduz erro de endereço e habilita matching geográfico para prestadores.
- **Riscos operacionais:** divergência entre menu “Endereços” do dashboard (**placeholder** na rota) e gestão real na **Minha conta** pode confundir atendimento.

## 2. Visão geral funcional

- **Objetivo:** CRUD de endereços + utilitários de geografia (estados, cidades, bairros) e resolução por CEP quando aplicável.
- **Escopo:** front-end + chamadas Supabase; regras de persistência no Postgres.
- **Limites:** não define política comercial de raio de atendimento (isso é do prestador).
- **Relação com outros módulos:** consumido por `request-quote` e `my-account`.

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Gestão e seleção de endereços | Formulários, lista, mapa, CEP, integração com pedido e conta | [features/gestao-de-enderecos.md](./features/gestao-de-enderecos.md) |

## 4. Perfis envolvidos

| Papel | Acesso |
|-------|--------|
| Cliente | CRUD e seleção nos fluxos integrados |
| Prestador | Indireto apenas via dados públicos de pedidos (fora deste módulo) |
| Admin | Via políticas no banco (não UI dedicada neste módulo) |

## 5. Principais fluxos do módulo

- **Entrada:** usuário abre pedido de orçamento ou seção de endereços na conta.
- **Processamento:** validação de formulário, consulta a cidades/bairros, gravação em `client_addresses`.
- **Saída:** endereço disponível para seleção em novos pedidos.
- **Dependências:** `profiles`, `platform_states`, `platform_cities`, `platform_neighborhoods`.

## 6. Regras de negócio transversais

- Endereço vinculado ao `client_id` (perfil do cliente).
- Geometria/localização pode ser sincronizada com pedidos via triggers em `service_requests` (ver migrations).

## 7. Entidades e dados relevantes

- **`client_addresses`:** endereço do cliente, FKs para estado/cidade, campos de localização.
- **Tabelas de plataforma:** estados, cidades, bairros.

## 8. Integrações relacionadas

- Serviços de CEP/resolução conforme implementação em `addresses` (ver feature).
- Sem Edge Function dedicada exclusiva ao módulo.

## 9. Riscos, lacunas e observações

- Rota `/dashboard/addresses` não usa este módulo — **placeholder**.

## 10. Evidências no código

- `src/features/addresses/` (api, components, hooks, schemas)
- `supabase/migrations/20260226100200_create_client_addresses.sql`
- `src/router.tsx` (rota placeholder)
- `src/features/my-account/components/MyAccountClientPage.tsx` (`AddressesSection`)
