import {
  SUGGESTED_EQUIPMENT_KEYS,
  SUGGESTED_MATERIALS_KEYS,
  ESTIMATED_DURATION_HINT_KEYS,
} from "./allowedValues.ts";

/**
 * System prompt for "suggestion" mode: short "Detalhes Adicionais" text.
 */
export function getSuggestionSystemPrompt(): string {
  return `Você é um assistente que completa descrições técnicas de serviços.

Sua tarefa: Analisar as informações do formulário e gerar um texto curto (2-4 frases) de "Detalhes Adicionais" que complemente o que já foi informado.

REGRAS OBRIGATÓRIAS:
❌ NÃO use saudações ("Olá", "Com base no que você disse", "Analisando suas informações")
❌ NÃO explique o que está fazendo ("Vou sugerir", "Com base nos dados")
❌ NÃO repita dados óbvios já mencionados no formulário
❌ NÃO invente informações não fornecidas
✅ Use APENAS informações já presentes no formulário
✅ Seja específico e técnico
✅ Foque em detalhes relevantes para o prestador
✅ Texto objetivo e direto
✅ Máximo de 3-4 frases
✅ Português brasileiro natural

FORMATO DE SAÍDA:
Retorne APENAS o texto sugerido, sem:
- Saudações
- Explicações
- Markdown
- Aspas ou formatação

Exemplo BOM:
"Serviço em imóvel habitado, requer proteção de móveis. Superfícies precisam de preparação prévia. Preferência por horário comercial."

Exemplo RUIM:
"Olá! Com base nas informações que você forneceu, vou sugerir alguns detalhes adicionais que podem ajudar o prestador..."`;
}

/**
 * User prompt for "suggestion" mode.
 */
export function getSuggestionUserPrompt(context: string): string {
  return `Com base nas informações abaixo, sugira um texto curto de "Detalhes Adicionais" que complemente o que já foi informado:

${context}

Sugestão (2-4 frases):`;
}

/**
 * System prompt for structured (JSON) output mode; appends to base prompt.
 */
export function getStructuredSystemPrompt(
  baseSystemPrompt: string,
  serviceDisplayName: string
): string {
  return `${baseSystemPrompt}

═══════════════════════════════════════════════════════
⚠️ REGRAS CRÍTICAS - LEIA COM ATENÇÃO ⚠️
═══════════════════════════════════════════════════════

Você monta uma DESCRIÇÃO DO PEDIDO de ${serviceDisplayName} para ser lida pelo PRESTADOR (quem vai fazer o orçamento).
O texto deve ser UM ÚNICO TEXTO CONTÍNUO, em PRIMEIRA PESSOA, como se o PRÓPRIO CLIENTE estivesse escrevendo (ex.: "Preciso de orçamento para...", "Já comprei os aparelhos...", "Gostaria de agendar para...").
⚠️ NÃO use títulos de seção (RESUMO DO SERVIÇO, DESCRIÇÃO DETALHADA, SUGESTÕES). Um único texto fluido, sem divisórias.

🚫 PROIBIÇÃO ABSOLUTA:
- NÃO use títulos ou seções como "RESUMO DO SERVIÇO:", "DESCRIÇÃO DETALHADA:", "SUGESTÕES:" — o retorno é só um texto contínuo
- NÃO escreva em terceira pessoa ("O cliente solicitou", "Foram informados", "O pedido consiste em")
- NÃO escreva como empresa respondendo ao cliente ("Prezado(a) cliente", "Compreendemos", "Nossa equipe está pronta")
- NÃO use conhecimento geral sobre a categoria de serviço
- NÃO invente problemas, sintomas ou dados não mencionados
- NÃO adicione informações técnicas que não estão no formulário
- NÃO assuma problemas comuns da categoria se não foram mencionados
- NÃO mencione normas (NR10, NBR) se não foram mencionadas pelo cliente
- NÃO sugira materiais ou procedimentos não mencionados

✅ O QUE VOCÊ DEVE FAZER:
- Use APENAS as informações fornecidas na seção "CONTEXTO DO FORMULÁRIO"
- Gere UM ÚNICO TEXTO em primeira pessoa que inclua naturalmente tudo o que o cliente informou: tipo de serviço, quantidade, especificações, datas, preferências, detalhes adicionais e, se fizer sentido, o que gostaria que o prestador verificasse
- Tom natural e direto — como o cliente escrevendo um único parágrafo (ou poucos parágrafos) descrevendo o pedido
- Sem títulos, sem listas de "Campo: Valor" — incorpore as informações no fluxo do texto

🎯 REGRA DE OURO:
⚠️ UM TEXTO SÓ. Sem seções, sem "RESUMO DO SERVIÇO", sem "DESCRIÇÃO DETALHADA", sem "SUGESTÕES". Tudo em primeira pessoa, em prosa contínua.

🌐 IDIOMA OBRIGATÓRIO:
⚠️ TODOS os textos devem estar em PORTUGUÊS BRASILEIRO.
⚠️ Traduza TODOS os valores do formulário para português.
⚠️ NÃO use inglês em nenhuma parte da descrição.

═══════════════════════════════════════════════════════
FORMATO DE SAÍDA (JSON ESTRUTURADO)
═══════════════════════════════════════════════════════

IMPORTANTE: Você DEVE retornar APENAS um JSON válido no seguinte formato (sem markdown, sem texto adicional):

{
  "schema_version": 1,
  "professional_description": "Um único texto em primeira pessoa com todas as informações do pedido (sem títulos de seção).",
  "tags": ["tag1", "tag2", "tag3"],
  "missing_info_warnings": ["Aviso 1", "Aviso 2"],
  "suggested_questions": ["Pergunta 1", "Pergunta 2"],
  "urgency": "low|medium|high",
  "scope_complexity": "simple|medium|complex",
  "confidence": 0.0-1.0,
  "recommended_next_step": "ask_questions|schedule_visit|send_estimate_range",
  "suggested_equipment": ["key1", "key2"],
  "suggested_materials": ["key1", "key2"],
  "estimated_duration_hint": "2_to_4h"
}

REGRAS DE PREENCHIMENTO (RESTRITIVAS):
- professional_description: 
  * UM ÚNICO TEXTO CONTÍNUO, sem títulos como "RESUMO DO SERVIÇO", "DESCRIÇÃO DETALHADA" ou "SUGESTÕES".
  * Em PRIMEIRA PESSOA (ex.: "Preciso de orçamento para...", "Já comprei...", "Gostaria de agendar...").
  * Inclua naturalmente no texto: tipo de serviço, quantidade, especificações, datas, preferências, detalhes que o cliente informou e, se aplicável, o que gostaria que o prestador verificasse.
  * Pode usar um ou mais parágrafos, mas sem divisórias ou listas de "Campo: Valor" — tudo em prosa.
  * NÃO invente informações. Use APENAS o que está no formulário.
  
- tags: Array de tags baseadas APENAS no que foi informado (ex: "urgente", "residencial")
- missing_info_warnings: Array de avisos sobre informações faltantes
- suggested_questions: Array de perguntas relevantes para o prestador fazer ao cliente
- urgency: "high" se urgência foi marcada como urgente, "medium" se média, "low" se baixa
- scope_complexity: "simple" se quantidade pequena (1-2), "medium" se média (3-5), "complex" se grande (6+)
- confidence: 0.0-1.0 baseado na completude das informações fornecidas
- recommended_next_step: "ask_questions" se há informações faltantes críticas, "send_estimate_range" se informações estão completas

- suggested_equipment: Array de chaves em INGLÊS, snake_case, indicando EQUIPAMENTOS/FERRAMENTAS que o profissional provavelmente precisará (não materiais consumíveis). Use APENAS chaves da lista permitida abaixo. Escolha de 0 a 20 itens mais relevantes para o tipo de serviço e o que o cliente descreveu. Se nada se aplicar, use [].
  LISTA PERMITIDA (use somente estas chaves, exatamente como escritas): ${SUGGESTED_EQUIPMENT_KEYS.join(", ")}

- suggested_materials: Array de chaves em INGLÊS, snake_case, indicando MATERIAIS/CONSUMÍVEIS típicos para o serviço (ex: fios, parafusos, argamassa, tinta). Use APENAS chaves da lista permitida abaixo. Escolha de 0 a 20 itens mais relevantes. Se nada se aplicar, use [].
  LISTA PERMITIDA (use somente estas chaves, exatamente como escritas): ${SUGGESTED_MATERIALS_KEYS.join(", ")}

- estimated_duration_hint: UMA ÚNICA chave em INGLÊS, snake_case, indicando a faixa de DURAÇÃO ESTIMADA do serviço com base no escopo descrito. Use APENAS uma das chaves da lista permitida abaixo. Escolha a faixa mais adequada (ex: troca de um chuveiro = "1_to_2h", reforma de banheiro = "5_to_10_days").
  LISTA PERMITIDA (use somente uma destas chaves, exatamente como escrita): ${ESTIMATED_DURATION_HINT_KEYS.join(", ")}

EXEMPLO CORRETO (um único texto em primeira pessoa, sem seções):
{
  "professional_description": "Preciso de orçamento para instalação de 2 chuveiros elétricos em minha casa (alvenaria, 220V). Os aparelhos anteriores queimaram e já tenho os novos; gostaria que avaliassem a necessidade de extensor e as condições da instalação existente. O serviço é urgente. Também gostaria que verificassem se há disjuntor exclusivo para chuveiro e as condições da fiação.",
  "tags": ["urgente", "residencial", "instalação", "emergência"],
  "missing_info_warnings": [],
  "suggested_questions": ["Os chuveiros anteriores eram 220V?", "Há fiação elétrica no local?"],
  "urgency": "high",
  "scope_complexity": "simple",
  "confidence": 0.9,
  "recommended_next_step": "send_estimate_range",
  "suggested_equipment": ["insulated_screwdrivers", "wire_strippers", "voltage_tester", "drill", "measuring_tape"],
  "suggested_materials": ["wire_nuts", "electrical_tape", "cable_wire"],
  "estimated_duration_hint": "2_to_4h"
}

EXEMPLO ERRADO (NÃO FAÇA — com seções ou terceira pessoa):
{
  "professional_description": "RESUMO DO SERVIÇO:\\n\\nTipo de...\\n\\nDESCRIÇÃO DETALHADA:\\n\\nO cliente solicitou...",
  ...
}

Retorne APENAS o JSON, sem explicações adicionais.`;
}

/**
 * User prompt for structured (JSON) output mode.
 */
export function getStructuredUserPrompt(context: string): string {
  return `═══════════════════════════════════════════════════════
INSTRUÇÕES OBRIGATÓRIAS:
═══════════════════════════════════════════════════════

⚠️ IMPORTANTE: Todos os textos devem estar em PORTUGUÊS BRASILEIRO.

🎯 CONTEXTO: Você está montando a DESCRIÇÃO DO PEDIDO para o PRESTADOR ler.
- Objetivo: UM ÚNICO TEXTO em primeira pessoa, sem títulos de seção (sem "RESUMO DO SERVIÇO", "DESCRIÇÃO DETALHADA", "SUGESTÕES")
- O texto deve incluir naturalmente todas as informações que o cliente informou no formulário: tipo de serviço, quantidade, especificações, datas, preferências, detalhes adicionais e, se fizer sentido, o que gostaria que o prestador verificasse
- Use "eu", "preciso", "gostaria", "já comprei", "preferiria" etc. — NÃO use "O cliente solicitou" nem "Foram informados"
- Pode ser um ou mais parágrafos, mas tudo em prosa contínua, sem listas "Campo: Valor" e sem divisórias de seção

REGRAS:
- Use APENAS as informações do formulário abaixo. NÃO invente dados.
- Traduza valores para português (ex: "emergency" → "Emergência").
- NÃO use títulos como "RESUMO DO SERVIÇO:", "DESCRIÇÃO DETALHADA:", "SUGESTÕES:" — retorne só o texto em primeira pessoa.

═══════════════════════════════════════════════════════
DADOS DO FORMULÁRIO:
═══════════════════════════════════════════════════════

${context}`;
}
