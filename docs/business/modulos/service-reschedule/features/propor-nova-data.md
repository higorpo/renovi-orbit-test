# Propor nova data (reagendamento)

## 1. Resumo executivo

Quando o prestador **propõe uma nova data** de reagendamento, o dialog “Propor nova data” permite informar **tempo estimado para executar** e **unidade** (horas/dias), além de data(s) e turno. Os campos de duração vêm **pré-preenchidos** com `duration_unit` e `duration_value` do serviço contratado (proposta aceita) e podem ser **alterados** pelo prestador na proposta, com os **mesmos limites** do composer de proposta (máx. 24 horas / 7 dias).

O modo do formulário (data única vs período) deriva da **duração informada na proposta** — não de uma escolha livre “com ou sem fim”. Ao aceitar, a duração do serviço contratado é atualizada a partir do slot proposto.

## 2. Duração no dialog

| Campo na UI | Comportamento |
|-------------|---------------|
| **Tempo estimado para executar** | Numérico inteiro > 0. Pré-preenchido com `duration_value` do serviço contratado. Editável pelo prestador. |
| **Unidade** | `Horas` ou `Dias`. Pré-preenchida com `duration_unit` do serviço contratado. Editável pelo prestador. |

### Limites (iguais ao composer de proposta)

| Unidade | Máximo |
|---------|--------|
| Horas | 24 |
| Dias | 7 (1 semana) |

| Camada | Evidência |
|--------|-----------|
| Front (Zod) | `MAX_PROPOSAL_DURATION_HOURS` / `MAX_PROPOSAL_DURATION_DAYS` em `proposeRescheduleFormSchema` |
| Backend | `_cns_validate_reschedule_slot`: rejeita `duration_value > 24` (horas) ou `> 7` (dias) |

### Fonte do pré-preenchimento

| Campo | Origem |
|-------|--------|
| `duration_unit` | `contracted_services.duration_unit` (proposta aceita), exposto no snapshot |
| `duration_value` | `contracted_services.duration_value` (proposta aceita), exposto no snapshot |

O snapshot JSON da solicitação inclui `duration_unit` e `duration_value` do serviço contratado. O front mapeia em `mapRescheduleSnapshot`; ao abrir o dialog, `ProposeRescheduleDialog` faz `reset` do formulário com esses valores.

## 3. Modos de data (`deriveRescheduleDateMode`)

O modo reage à **unidade e ao valor informados no formulário** (inicialmente os do contrato; podem mudar antes do envio).

| Condição | Modo | Campos no dialog “Propor nova data” |
|----------|------|-------------------------------------|
| `duration_unit = hours` | **Data única** (`single_day`) | Só **Data de execução** (+ turno). Sem campo de data de fim. |
| `duration_unit = days` e `duration_value` ≥ 2 | **Período** (`date_range`) | **Data de início** + **Data de fim** (+ turno). |

`days` + `duration_value = 1` **não é permitido** no formulário (use `hours`).

Alterar unidade ou valor no dialog **mostra ou oculta** o campo de data de fim em tempo real (`showEndDate`).

## 4. Persistência do slot proposto

Função de montagem: `buildRescheduleProposedSlot`.

O JSON do slot proposto inclui **`duration_unit`** e **`duration_value`** além de datas e turno.

| Caso | `start_date` | `end_date` | `duration_unit` / `duration_value` |
|------|--------------|------------|-------------------------------------|
| Horas (inclui serviço de um único dia) | data escolhida | `null` | valores informados no formulário |
| Vários dias (`days` + `duration_value` ≥ 2) | início | fim informado (obrigatório) | valores informados no formulário |

**Regra:** `days` + `duration_value = 1` **não é permitido** na proposta nem no reagendamento — use `hours`.

### Efeito no aceite

Ao **aceitar** a proposta de reagendamento, `_cns_apply_service_reschedule_slot` persiste no `contracted_services`:

- `duration_unit` e `duration_value` — preferindo os embutidos no slot proposto; se ausentes (legado), mantém os do contrato;
- `scheduled_start_date`, `scheduled_end_date`, `scheduled_shift`, `agreed_slot`.

## 5. Validação de duração (multi-dia)

No modo período, o intervalo deve bater a **duração informada na proposta** com a **mesma regra da criação de proposta**:

- dias **corridos** inclusivos **ou**
- dias **úteis** inclusivos (segunda a sexta)

devem ser iguais a `duration_value` (do formulário / embutido no slot).

| Camada | Evidência |
|--------|-----------|
| Front (Zod) | `matchesProposalDayDurationISO` em `proposeRescheduleFormSchema` |
| Backend | `_cns_validate_reschedule_slot`: lê `duration_unit` / `duration_value` do slot (fallback: contrato); compara `(end − start + 1)` **ou** `count_inclusive_working_days(start, end)` com `duration_value` |

### Backend — forma do slot (`_cns_validate_reschedule_slot`)

- **Horas:** `end_date` deve estar ausente / vazio; se vier preenchido → erro de fim inválido.
- **Dias:** `end_date` é **obrigatório** (incluindo o caso de 1 dia, em que fim = início).
- Fim anterior ao início → inválido.
- Duração incompatível (nem corridos nem úteis) → `INVALID_SLOT_DURATION`.
- `duration_value` fora dos limites (horas > 24, dias > 7) → `INVALID_SLOT_DURATION`.

## 6. Cópias e formatação na UI

| Contexto | Data única | Período (fim ≠ início) |
|----------|------------|-------------------------|
| Labels do dialog | “Data de execução” | “Data de início” + “Data de fim” |
| Seção do card (proposta / aceito / substituído) | “Data proposta” | “Período proposto” |
| Formatação exibida | data + turno | `início até fim (turno)` |

`formatRescheduleSlot` **não** mostra intervalo quando `end_date` é `null` ou igual a `start_date`.

## 7. Perfis e ações (neste fluxo)

| Papel | Ação documentada aqui |
|-------|------------------------|
| Prestador | Abre “Propor nova data”; pode ajustar tempo estimado, unidade, data(s) e turno; envia o slot validado |
| Cliente | Vê “Data proposta” / “Período proposto” no card; aceite formal é outro passo (fora do detalhe deste doc) |

## 8. Evidências

| Tema | Onde |
|------|------|
| Modo de data | `src/features/service-reschedule/utils/deriveRescheduleDateMode.ts` |
| Formulário / limites | `src/features/service-reschedule/types/serviceReschedule.forms.ts`; constantes em `src/features/negotiation-proposals/constants/proposalComposer.ts` |
| Dialog | `src/features/service-reschedule/components/ProposeRescheduleDialog.tsx` |
| Snapshot / pré-preenchimento | `src/features/service-reschedule/utils/mapRescheduleSnapshot.ts`; SQL de snapshot em migrations `20260802*` |
| Labels do card | `src/features/service-reschedule/utils/rescheduleCardCopy.ts` |
| Formatação | `src/features/service-reschedule/utils/formatRescheduleSlot.ts` |
| Validação e aceite (SQL) | `supabase/migrations/20260802020000_service_reschedule_helpers.sql` (`_cns_validate_reschedule_slot`, `_cns_apply_service_reschedule_slot`); `20260802150000_service_reschedule_apply_slot_restore_claims.sql` |
| Testes unitários | `utils/__tests__/deriveRescheduleDateMode.test.ts`, `types/__tests__/serviceReschedule.forms.test.ts` |

## 9. Lacunas / fora de escopo deste documento

- Regras completas de quem pode solicitar, cancelar, pedir ajuste, aceitar ou expirar a solicitação.
- Integração detalhada com recálculo de cobrança após aceite (ver módulo `payments` / `docs/payment-system/`).
