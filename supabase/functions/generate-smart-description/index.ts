// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Deno runtime; editor TS cannot validate Deno imports
// @ts-nocheck

/**
 * Generate Smart Description Edge Function
 * Requires body.service (service id). Fetches prompt from services.ai_prompt_id; fallback to description_default or inline.
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { checkRateLimit, getClientIP, getUserIdFromRequest } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------- Constants ----------
const CACHE_TTL_MS = 5 * 60 * 1000;
const FORM_DATA_MAX_BYTES = 50_000;
const SUGGESTION_TRUNCATE_CHARS = 500;
const MAX_CONTEXT_DEPTH = 3;

interface PromptConfig {
  id: string;
  prompt_key: string;
  name: string;
  system_prompt: string;
  user_prompt_template: string | null;
  category_slug: string | null;
  use_case: string;
  max_tokens: number;
  temperature: number;
  variables_schema: Record<string, unknown>;
  formatting_rules: {
    use_caps_titles?: boolean;
    use_block_separation?: boolean;
    allow_markdown?: boolean;
    word_limit?: number;
  };
  version: number;
}

const promptCache: Map<string, { data: PromptConfig; timestamp: number }> = new Map();

// ---------- Formatting ----------

/**
 * Format professional_description: normalize line breaks and section spacing.
 */
function formatProfessionalDescription(text: string): string {
  if (!text) return '';
  
  // Converter \\n em quebras de linha reais
  let formatted = text.replace(/\\n/g, '\n');
  
  // CORREÇÃO: Garantir que seções obrigatórias tenham quebra de linha adequada
  // Garantir que RESUMO DO SERVIÇO tenha quebra antes
  formatted = formatted.replace(/(RESUMO DO SERVIÇO:)/g, '\n\n$1\n');
  // Garantir que DESCRIÇÃO DETALHADA tenha quebra antes
  formatted = formatted.replace(/(DESCRIÇÃO DETALHADA:)/g, '\n\n$1\n');
  // Garantir que SUGESTÕES tenha quebra antes
  formatted = formatted.replace(/(SUGESTÕES:)/g, '\n\n$1\n');
  
  // Garantir que seções em CAPS tenham quebra de linha antes
  formatted = formatted.replace(/([.!?])\s*([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ]{3,}:)/g, '$1\n\n$2');
  
  // Limpar múltiplas quebras de linha (máximo 2)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  // Limpar espaços no início/fim de cada linha
  formatted = formatted.split('\n').map(line => line.trim()).join('\n');
  
  // Remover quebras de linha no início e fim
  formatted = formatted.trim();
  
  // CORREÇÃO: Se ainda não tem a estrutura obrigatória, adicionar aviso
  if (!formatted.includes('RESUMO DO SERVIÇO')) {
    console.warn('[formatProfessionalDescription] Required section not found in description');
  }
  
  return formatted;
}

/**
 * Remove markdown from AI output (headings to CAPS, strip bold/code/links).
 */
function removeMarkdown(text: string): string {
  let cleaned = text;
  
  // Converter ## Título para TÍTULO (cabeçalhos markdown)
  cleaned = cleaned.replace(/^#{1,6}\s*(.+)$/gm, (_, title) => title.toUpperCase());
  
  // Remover bold/italic (**text** ou *text*)
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  cleaned = cleaned.replace(/__(.+?)__/g, '$1');
  cleaned = cleaned.replace(/_(.+?)_/g, '$1');
  
  // Remover code blocks (```text```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`(.+?)`/g, '$1');
  
  // Remover links [text](url)
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remover listas markdown (- item ou * item) mantendo o conteúdo
  cleaned = cleaned.replace(/^[\s]*[-*]\s+/gm, '• ');
  
  // Remover listas numeradas (1. item)
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '• ');
  
  return cleaned.trim();
}

/**
 * Structure text in blocks with optional CAPS titles and block separation.
 */
function structureInBlocks(text: string, formattingRules: PromptConfig['formatting_rules']): string {
  const useCaps = formattingRules.use_caps_titles !== false;
  const useBlockSeparation = formattingRules.use_block_separation !== false;
  
  let structured = text;
  
  if (useCaps) {
    // Identificar padrões de títulos e converter para CAPS
    // Padrão: linha que termina com ":" no início de um bloco
    structured = structured.replace(/^([A-Za-zÀ-ÿ\s]+):$/gm, (_, title) => {
      return title.toUpperCase().trim() + ':';
    });
    
    // Padrão: TÍTULO seguido de texto
    structured = structured.replace(/^([A-Z][A-Za-zÀ-ÿ\s]{2,30})(?=\n[A-Za-z])/gm, (match) => {
      return match.toUpperCase();
    });
  }
  
  if (useBlockSeparation) {
    // Garantir linha em branco entre blocos (antes de títulos em CAPS)
    structured = structured.replace(/([^\n])\n([A-ZÁÀÃÂÉÈÊÍÌÓÒÕÔÚÙÇ][A-ZÁÀÃÂÉÈÊÍÌÓÒÕÔÚÙÇ\s]+:)/g, '$1\n\n$2');
    
    // Remover linhas em branco excessivas (mais de 2)
    structured = structured.replace(/\n{3,}/g, '\n\n');
  }
  
  return structured.trim();
}

/**
 * Add "SUGESTÃO DO PROFISSIONAL" section if missing (category-based default text).
 */
function ensureProfessionalSuggestion(text: string, service: string): string {
  // Verificar se já tem alguma variação da seção de sugestão
  const suggestionPatterns = [
    /SUGEST[ÃA]O\s*(DO|DA)?\s*PROFISSIONAL/i,
    /RECOMENDA[ÇC][ÃA]O\s*(DO|DA)?\s*PROFISSIONAL/i,
    /DICA\s*(DO|DA)?\s*PROFISSIONAL/i,
    /SUGEST[ÕO]ES?\s*(DO|DA)?\s*ESPECIALISTA/i,
  ];
  
  const hasSuggestion = suggestionPatterns.some(pattern => pattern.test(text));
  
  if (hasSuggestion) {
    return text;
  }
  
  // Adicionar seção genérica de sugestão baseada na categoria
  const suggestions: Record<string, string> = {
    'pintor': 'Recomendo aplicar fundo preparador antes da pintura para melhor aderência e durabilidade. Tintas de qualidade premium oferecem melhor cobertura e rendimento.',
    'eletricista': 'Sugiro uma revisão geral do quadro elétrico para garantir segurança. Disjuntores atualizados e aterramento adequado são essenciais.',
    'encanador': 'Recomendo verificar a pressão da água e o estado das conexões existentes. Materiais de qualidade evitam vazamentos futuros.',
    'ar-condicionado': 'Sugiro manutenção preventiva semestral para maior eficiência e vida útil do equipamento. Filtros limpos reduzem consumo de energia.',
    'marceneiro': 'Recomendo utilizar madeira de reflorestamento certificada. Acabamento com verniz PU oferece maior durabilidade e resistência.',
    'montador': 'Sugiro verificar as condições das paredes para fixação segura. Buchas e parafusos adequados garantem estabilidade.',
    'pedreiro': 'Recomendo impermeabilização adequada e uso de materiais certificados. Fundação e estrutura bem executadas evitam problemas futuros.',
    'reparos': 'Sugiro uma avaliação geral do imóvel para identificar outros reparos preventivos. Manutenção regular evita gastos maiores.',
  };
  
  const normalizedSlug = normalizeCategorySlug(service);
  const suggestion = suggestions[normalizedSlug] ||
    'Sugiro uma avaliação presencial para melhor dimensionamento do serviço e garantia de qualidade na execução.';
  
  return `${text}\n\nSUGESTÃO DO PROFISSIONAL:\n${suggestion}`;
}

/**
 * Apply word limit when configured; cut near sentence boundary when possible.
 */
function applyWordLimit(text: string, maxWords?: number): string {
  if (!maxWords || maxWords <= 0) return text;
  
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  
  // Encontrar o ponto de corte mais próximo de um fim de frase
  let cutPoint = maxWords;
  for (let i = maxWords; i > maxWords - 20 && i > 0; i--) {
    if (words[i]?.endsWith('.') || words[i]?.endsWith(':')) {
      cutPoint = i + 1;
      break;
    }
  }
  
  return words.slice(0, cutPoint).join(' ');
}

/** Normalize category to slug (lowercase, no accents, hyphen-separated). */
function normalizeCategorySlug(category: string): string {
  return category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, '-');
}

/**
 * Full post-processing pipeline: markdown, blocks, suggestion section, word limit.
 */
function postProcessDescription(
  rawText: string, 
  service: string,
  formattingRules: PromptConfig['formatting_rules']
): string {
  let processed = rawText;
  
  // 1. Remover markdown se não permitido
  if (!formattingRules.allow_markdown) {
    processed = removeMarkdown(processed);
  }
  
  // 2. Estruturar em blocos com CAPS
  processed = structureInBlocks(processed, formattingRules);
  
  // 3. Garantir seção de sugestão do profissional
  processed = ensureProfessionalSuggestion(processed, service);
  
  // 4. Aplicar limite de palavras
  processed = applyWordLimit(processed, formattingRules.word_limit);
  
  // 5. Limpeza final
  processed = processed
    .replace(/\n{3,}/g, '\n\n')  // Máximo 2 quebras de linha
    .replace(/^\s+|\s+$/gm, '')   // Trim em cada linha
    .trim();
  
  return processed;
}

// ---------- Prompt from DB ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase client from Deno esm.sh
async function getPromptFromDB(supabase: any, promptKey: string): Promise<PromptConfig | null> {
  // Verificar cache
  const cached = promptCache.get(promptKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.log(`[Prompt] Cache hit for: ${promptKey}`);
    return cached.data;
  }

  console.log(`[Prompt] Fetching from DB: ${promptKey}`);
  
  try {
    // Buscar via RPC
    const { data, error } = await supabase.rpc('get_prompt_by_key', {
      p_prompt_key: promptKey
    });

    if (error) {
      console.error(`[Prompt] RPC error:`, error);
      return null;
    }

    if (data) {
      // Garantir formatting_rules tem valores padrão
      const normalizedData = {
        ...data,
        formatting_rules: {
          use_caps_titles: true,
          use_block_separation: true,
          allow_markdown: false,
          word_limit: 300,
          ...(typeof data.formatting_rules === 'object' ? data.formatting_rules : {})
        }
      };
      
      // Atualizar cache
      promptCache.set(promptKey, { data: normalizedData, timestamp: Date.now() });
      console.log(`[Prompt] Cached: ${promptKey} (v${normalizedData.version})`);
      
      return normalizedData;
    }

    return null;
  } catch (err) {
    console.error(`[Prompt] Exception:`, err);
    return null;
  }
}

/** Fetch prompt by id from ai_prompts (used when service.ai_prompt_id is set). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase client from Deno
async function getPromptById(supabase: any, promptId: string): Promise<PromptConfig | null> {
  const cacheKey = `id:${promptId}`;
  const cached = promptCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.log(`[Prompt] Cache hit for id: ${promptId}`);
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from('ai_prompts')
      .select('id, prompt_key, name, system_prompt, user_prompt_template, category_slug, use_case, max_tokens, temperature, variables_schema, formatting_rules, version')
      .eq('id', promptId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error(`[Prompt] Fetch by id error:`, error);
      return null;
    }

    const normalizedData: PromptConfig = {
      ...data,
      formatting_rules: {
        use_caps_titles: true,
        use_block_separation: true,
        allow_markdown: false,
        word_limit: 300,
        ...(typeof data.formatting_rules === 'object' && data.formatting_rules ? data.formatting_rules as object : {}),
      },
    };
    promptCache.set(cacheKey, { data: normalizedData, timestamp: Date.now() });
    console.log(`[Prompt] Cached by id: ${promptId} (${normalizedData.prompt_key} v${normalizedData.version})`);
    return normalizedData;
  } catch (err) {
    console.error(`[Prompt] Exception getPromptById:`, err);
    return null;
  }
}

/** Invalidate prompt cache (all or by key). Exposed for future admin use. */
function _invalidatePromptCache(promptKey?: string) {
  if (promptKey) {
    promptCache.delete(promptKey);
    console.log(`[Cache] Invalidated: ${promptKey}`);
  } else {
    promptCache.clear();
    console.log(`[Cache] Cleared all`);
  }
}

// ---------- Format form data for AI context ----------
/**
 * Build readable context string from formData, notes, and optional provider/location context.
 */
function formatFormDataToContext(
  service: string,
  formData: Record<string, unknown>, 
  userNotes?: string,
  additionalDetails?: string | null,
  mode?: string,
  userContext?: Record<string, unknown>,
  locationContext?: Record<string, unknown>,
  proposedPrice?: number | null,
  providerNotes?: string | null
): string {
  let context = '';

  // CORREÇÃO: Mapeamentos completos de tradução para português
  const propertyTypeMap: Record<string, string> = {
    house: 'Casa', 
    apartment: 'Apartamento', 
    commercial: 'Comercial/Loja', 
    warehouse: 'Galpão', 
    other: 'Outro'
  };

  const urgencyMap: Record<string, string> = {
    urgent: 'Urgente', 
    emergency: 'Emergência',
    asap: 'O quanto antes', 
    'next-week': 'Próxima semana',
    '30-days': 'Próximos 30 dias', 
    flexible: 'Flexível', 
    normal: 'Normal',
    schedule: 'Data específica'
  };

  // CORREÇÃO: Mapeamento de localizações (encanador)
  const locationMap: Record<string, string> = {
    bathroom: 'Banheiro',
    kitchen: 'Cozinha',
    laundry: 'Área de Serviço',
    external: 'Área Externa',
    pool: 'Piscina',
    bedroom: 'Quarto',
    living: 'Sala',
    other: 'Outro'
  };

  // CORREÇÃO: Mapeamento de tipos de problema (encanador)
  const problemTypeMap: Record<string, string> = {
    leak: 'Vazamento',
    clog: 'Entupimento',
    installation: 'Instalação',
    renovation: 'Reforma',
    'leak-detection': 'Caça Vazamento'
  };

  // CORREÇÃO: Mapeamento de tipos de serviço (eletricista)
  const serviceTypeMap: Record<string, string> = {
    'install-shower': 'Instalação de Chuveiro Elétrico',
    lighting: 'Iluminação',
    outlets: 'Tomadas/Interruptores',
    'install-fan': 'Ventilador de Teto',
    breaker: 'Quadro de Luz',
    'short-circuit': 'Curto-circuito',
    wiring: 'Fiação/Cabeamento',
    pattern: 'Padrão de Entrada'
  };

  // CORREÇÃO: Mapeamento de tipo de parede
  const wallTypeMap: Record<string, string> = {
    masonry: 'Alvenaria',
    drywall: 'Gesso/Drywall',
    wood: 'Madeira',
    exposed: 'Exposto'
  };

  // CORREÇÃO: Mapeamento de voltagem
  const voltageMap: Record<string, string> = {
    '110v': '110V',
    '220v': '220V',
    bivolt: 'Bivolt',
    'dont-know': 'Não sei'
  };

  // CORREÇÃO: Mapeamento de altura do teto
  const ceilingHeightMap: Record<string, string> = {
    standard: 'Padrão (até 3m)',
    high: 'Alto (3-4m)',
    'very-high': 'Muito alto (+4m)'
  };

  // CORREÇÃO: Função helper para traduzir valores
  const translateValue = (key: string, value: string): string => {
    const keyLower = key.toLowerCase();
    const valueLower = value.toLowerCase();
    
    // Traduzir baseado na chave primeiro (mais específico)
    if (keyLower.includes('property') || keyLower.includes('tipo_imovel') || keyLower.includes('property_type')) {
      return propertyTypeMap[valueLower] || propertyTypeMap[value] || value;
    }
    if (keyLower.includes('urgency') || keyLower.includes('urgencia')) {
      return urgencyMap[valueLower] || urgencyMap[value] || value;
    }
    if (keyLower.includes('location') || keyLower.includes('local')) {
      return locationMap[valueLower] || locationMap[value] || value;
    }
    if (keyLower.includes('problem') || keyLower.includes('problema') || keyLower.includes('problem_type')) {
      return problemTypeMap[valueLower] || problemTypeMap[value] || value;
    }
    if (keyLower.includes('service') || keyLower.includes('servico') || keyLower.includes('service_type') || keyLower.includes('service_types')) {
      return serviceTypeMap[valueLower] || serviceTypeMap[value] || value;
    }
    if (keyLower.includes('wall') || keyLower.includes('parede') || keyLower.includes('wall_type')) {
      return wallTypeMap[valueLower] || wallTypeMap[value] || value;
    }
    if (keyLower.includes('voltage') || keyLower.includes('voltagem')) {
      return voltageMap[valueLower] || voltageMap[value] || value;
    }
    if (keyLower.includes('ceiling') || keyLower.includes('altura') || keyLower.includes('teto') || keyLower.includes('ceiling_height')) {
      return ceilingHeightMap[valueLower] || ceilingHeightMap[value] || value;
    }
    
    // Tentar mapeamentos gerais (fallback)
    return propertyTypeMap[valueLower] || propertyTypeMap[value] ||
           urgencyMap[valueLower] || urgencyMap[value] ||
           locationMap[valueLower] || locationMap[value] ||
           problemTypeMap[valueLower] || problemTypeMap[value] ||
           serviceTypeMap[valueLower] || serviceTypeMap[value] ||
           wallTypeMap[valueLower] || wallTypeMap[value] ||
           voltageMap[valueLower] || voltageMap[value] ||
           ceilingHeightMap[valueLower] || ceilingHeightMap[value] ||
           value;
  };

  // Build context from category/service
  context += `SERVIÇO: ${service.toUpperCase()}\n\n`;

  // Size check for token cost control
  const formDataSize = JSON.stringify(formData).length;
  if (formDataSize > FORM_DATA_MAX_BYTES) {
    console.warn(`[formatFormDataToContext] Large formData: ${formDataSize} bytes`);
  }

  const processValue = (key: string, value: unknown, depth: number = 0): string => {
    if (depth > MAX_CONTEXT_DEPTH) return String(value);
    
    if (value === null || value === undefined || value === '') return '';
    
    // Ignorar campos internos e campos muito grandes (controle de custo)
    if (key.startsWith('_')) return '';
    
    // Truncate very long strings in suggestion mode to save tokens
    if (mode === 'suggestion' && typeof value === 'string' && value.length > SUGGESTION_TRUNCATE_CHARS) {
      return `${key}: ${value.substring(0, SUGGESTION_TRUNCATE_CHARS)}... (texto truncado)`;
    }
    
    // CORREÇÃO: Formatar chave traduzindo para português
    let formattedKey = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ');
    
    // Traduzir chaves comuns
    const keyTranslations: Record<string, string> = {
      'property type': 'Tipo de Imóvel',
      'property_type': 'Tipo de Imóvel',
      'urgency': 'Urgência',
      'location': 'Local',
      'problem type': 'Tipo de Problema',
      'problem_type': 'Tipo de Problema',
      'service type': 'Tipo de Serviço',
      'service_type': 'Tipo de Serviço',
      'service types': 'Tipos de Serviço',
      'service_types': 'Tipos de Serviço',
      'wall type': 'Tipo de Parede',
      'wall_type': 'Tipo de Parede',
      'voltage': 'Voltagem',
      'points count': 'Quantidade de Pontos',
      'points_count': 'Quantidade de Pontos',
      'ceiling height': 'Altura do Teto',
      'ceiling_height': 'Altura do Teto',
      'additional details': 'Detalhes Adicionais',
      'additional_details': 'Detalhes Adicionais'
    };
    
    const keyLower = formattedKey.toLowerCase();
    if (keyTranslations[keyLower]) {
      formattedKey = keyTranslations[keyLower];
    }

    let formattedValue: string;

    if (Array.isArray(value)) {
      formattedValue = value.map(v => {
        if (typeof v === 'object' && v !== null) {
          return JSON.stringify(v);
        }
        if (typeof v === 'string') {
          // CORREÇÃO: Traduzir cada valor do array
          return translateValue(key, v);
        }
        return String(v);
      }).join(', ');
    } else if (typeof value === 'object') {
      // Processar objeto aninhado recursivamente
      const nested: string[] = [];
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        const nestedResult = processValue(nestedKey, nestedValue, depth + 1);
        if (nestedResult) {
          nested.push(`  ${nestedKey}: ${nestedResult}`);
        }
      }
      formattedValue = nested.length > 0 ? `\n${nested.join('\n')}` : JSON.stringify(value);
    } else if (typeof value === 'boolean') {
      formattedValue = value ? 'Sim' : 'Não';
    } else if (typeof value === 'number') {
      formattedValue = String(value);
      if (key.toLowerCase().includes('area') || key.toLowerCase().includes('metragem')) {
        formattedValue += ' m²';
      }
      if (key.toLowerCase().includes('btus')) formattedValue += ' BTUs';
      if (key.toLowerCase().includes('valor') || key.toLowerCase().includes('preco')) {
        formattedValue = `R$ ${formattedValue}`;
      }
    } else {
      // CORREÇÃO: Traduzir valor string usando função helper
      if (typeof value === 'string') {
        formattedValue = translateValue(key, value);
      } else {
        formattedValue = String(value);
      }
    }

    return `${formattedKey}: ${formattedValue}`;
  };

  // Processar todos os campos do formData
  // CORREÇÃO: Garantir que TODOS os campos sejam capturados, mesmo se estiverem vazios
  const processedKeys = new Set<string>();
  
  for (const [key, value] of Object.entries(formData)) {
    // Ignorar campos vazios, mas processar todos os campos com valor
    if (value !== null && value !== undefined && value !== '') {
      const result = processValue(key, value);
      if (result) {
        context += `${result}\n`;
        processedKeys.add(key);
      }
    }
  }
  
  // Log para debug: verificar quais campos foram processados
  if (Object.keys(formData).length > 0) {
    console.log(`[formatFormDataToContext] Campos processados: ${Array.from(processedKeys).join(', ')}`);
    console.log(`[formatFormDataToContext] Total de campos no formData: ${Object.keys(formData).length}`);
  }

  // NOVO: Incluir "Detalhes Adicionais" da etapa 2 (se disponível)
  if (additionalDetails && additionalDetails.trim()) {
    context += `\nDETALHES ADICIONAIS FORNECIDOS PELO CLIENTE (ETAPA 2):\n${additionalDetails.trim()}\n`;
  }

  // Observações do cliente (etapa 3)
  if (userNotes && userNotes.trim()) {
    context += `\nOBSERVAÇÕES ADICIONAIS DO CLIENTE (ETAPA 3):\n${userNotes.trim()}\n`;
  }

  return context;
}

// ---------- Log usage (analytics) ----------
async function logPromptUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase client from Deno
  supabase: any,
  promptId: string,
  userId: string | null,
  requestId: string | null,
  success: boolean,
  tokensUsed?: number,
  generationTimeMs?: number,
  errorMessage?: string
) {
  try {
    await supabase.from('ai_prompt_usage').insert({
      prompt_id: promptId,
      user_id: userId,
      request_id: requestId,
      tokens_used: tokensUsed,
      generation_time_ms: generationTimeMs,
      success,
      error_message: errorMessage,
      session_id: crypto.randomUUID()
    });
    console.log(`[Usage] Logged: prompt=${promptId}, success=${success}, tokens=${tokensUsed}`);
  } catch (err) {
    console.warn('[Usage Log] Failed to log:', err);
  }
}

// ========== INTERFACES PARA FASE 3 ==========

interface StructuredAIResponse {
  schema_version: number;
  professional_description: string;
  tags: string[];
  missing_info_warnings: string[];
  suggested_questions: string[];
  urgency: "low" | "medium" | "high";
  scope_complexity: "simple" | "medium" | "complex";
  confidence: number;
  recommended_next_step: "ask_questions" | "schedule_visit" | "send_estimate_range";
}

/**
 * Normalizar tags usando whitelist
 */
function normalizeTags(tags: string[], whitelist?: string[]): string[] {
  if (!whitelist || whitelist.length === 0) {
    return tags;
  }
  
  const normalized: string[] = [];
  const whitelistLower = whitelist.map(t => t.toLowerCase());
  
  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    // Buscar match exato ou parcial na whitelist
    const match = whitelistLower.find(w => 
      w === tagLower || tagLower.includes(w) || w.includes(tagLower)
    );
    
    if (match) {
      // Usar o valor da whitelist (padronizado)
      const originalIndex = whitelistLower.indexOf(match);
      normalized.push(whitelist[originalIndex]);
    }
  }
  
  return [...new Set(normalized)]; // Remover duplicatas
}

/**
 * Validar JSON estruturado retornado pela IA
 */
function validateStructuredResponse(data: unknown): StructuredAIResponse | null {
  try {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    if (typeof d.professional_description !== 'string') return null;
    if (!Array.isArray(d.tags)) return null;
    if (!Array.isArray(d.missing_info_warnings)) return null;
    if (!['low', 'medium', 'high'].includes(d.urgency as string)) return null;
    if (!['simple', 'medium', 'complex'].includes(d.scope_complexity as string)) return null;
    
    return {
      schema_version: (d.schema_version as number) || 1,
      professional_description: (d.professional_description as string) || '',
      tags: Array.isArray(d.tags) ? d.tags as string[] : [],
      missing_info_warnings: Array.isArray(d.missing_info_warnings) ? d.missing_info_warnings as string[] : [],
      suggested_questions: Array.isArray(d.suggested_questions) ? d.suggested_questions as string[] : [],
      urgency: (d.urgency as string) || 'medium',
      scope_complexity: (d.scope_complexity as string) || 'medium',
      confidence: typeof d.confidence === 'number' ? Math.max(0, Math.min(1, d.confidence)) : 0.7,
      recommended_next_step: (d.recommended_next_step as string) || 'send_estimate_range',
    };
  } catch (err) {
    console.error('[Validation] Erro ao validar resposta estruturada:', err);
    return null;
  }
}

/**
 * Gerar fallback estruturado em caso de erro
 */
function generateFallbackResponse(description: string, _service: string): StructuredAIResponse {
  return {
    schema_version: 1,
    professional_description: description,
    tags: [],
    missing_info_warnings: [],
    suggested_questions: [],
    urgency: 'medium',
    scope_complexity: 'medium',
    confidence: 0.5,
    recommended_next_step: 'send_estimate_range',
  };
}

// ========== HANDLER PRINCIPAL ==========
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let promptConfig: PromptConfig | null = null;
  let userId: string | null = null;
  let parsedServiceId: string | undefined;

  try {
    // ========== RATE LIMITING ==========
    const clientIP = getClientIP(req);
    userId = await getUserIdFromRequest(req);
    
    const rl = await checkRateLimit(clientIP, userId, "generate-smart-description", {
      perMinute: 60,
      burst: 10,
    });

    if (!rl.allowed) {
      console.log(`[RateLimit] Blocked: IP=${clientIP}, User=${userId}`);
      return new Response(JSON.stringify({
        error: "rate_limited",
        message: "Muitas requisições. Tente novamente em alguns segundos.",
        retryAfter: rl.retryAfter,
      }), { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json", 
          "Retry-After": String(rl.retryAfter) 
        } 
      });
    }

    // ========== PARSE REQUEST ==========
    const body = await req.json() as Record<string, unknown>;
    parsedServiceId = typeof body?.service === 'string' ? body.service : undefined;
    const serviceId = parsedServiceId ?? '';
    const formData = body?.formData || {};
    const userNotes = body?.userNotes || '';
    const requestId = body?.requestId || null;
    const isTestMode = body?.isTestMode || false;
    const forcePromptKey = body?.forcePromptKey || null;
    const useStructuredOutput = body?.useStructuredOutput !== false;
    const mode = body?.mode || 'full_description';
    const additionalDetails = body?.additionalDetails || null;
    
    const proposedPrice = body?.proposed_price || null;
    const providerNotes = body?.provider_notes || null;
    
    console.log("📋 Request:", { 
      serviceId, 
      formDataKeys: Object.keys(formData),
      formDataSample: Object.keys(formData).slice(0, 5).reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = formData[key];
        return acc;
      }, {}),
      formDataSize: JSON.stringify(formData).length,
      hasUserNotes: !!userNotes,
      proposedPrice, // NOVO
      providerNotes, // NOVO
      isTestMode,
      forcePromptKey,
      mode,
      additionalDetails: additionalDetails ? additionalDetails.substring(0, 100) + '...' : null
    });
    
    // Provider flow: proposed_price and provider_notes required only when sent (client request-quote does not send them)
    if (Object.prototype.hasOwnProperty.call(body, "proposed_price")) {
      if (!proposedPrice || parseFloat(proposedPrice) <= 0) {
        return new Response(
          JSON.stringify({
            error: "proposed_price é obrigatório",
            hint: "Informe o valor da proposta antes de gerar a descrição com IA",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "provider_notes")) {
      if (!providerNotes || providerNotes.trim().length < 20) {
        return new Response(
          JSON.stringify({
            error: "provider_notes muito curto",
            hint: "Descreva brevemente sua abordagem (mínimo 20 caracteres) antes de gerar com IA",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!serviceId) {
      return new Response(
        JSON.stringify({ error: "service é obrigatório (id do serviço)" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== SUPABASE CLIENT ==========
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========== STRUCTURED OUTPUT (FASE 3) ==========
    // Orbit: no get_ai_handover_settings; structured output when not suggestion and useStructuredOutput is true
    const enableStructured = mode !== 'suggestion' && useStructuredOutput;
    
    console.log(`[FASE3] Mode: ${mode}, Structured output: ${enableStructured ? 'enabled' : 'disabled'}`);

    // ========== FETCH SERVICE AND PROMPT ==========
    // serviceId is the service uuid. Prompt comes from service.ai_prompt_id; display name from service.title/slug.
    let serviceDisplayName = serviceId;

    if (forcePromptKey) {
      // Admin test mode: use specific prompt key
      promptConfig = await getPromptFromDB(supabase, forcePromptKey);
    } else {
      const { data: serviceRow, error: serviceError } = await supabase
        .from('services')
        .select('id, ai_prompt_id, slug, title')
        .eq('id', serviceId)
        .maybeSingle();

      if (serviceError) {
        console.warn('[Service] Fetch error:', serviceError);
      }
      if (serviceRow) {
        serviceDisplayName = serviceRow.title ?? serviceRow.slug ?? serviceId;
        if (serviceRow.ai_prompt_id) {
          promptConfig = await getPromptById(supabase, serviceRow.ai_prompt_id);
        }
      }

      if (!promptConfig) {
        console.log(`⚠️ No prompt from service, trying default`);
        promptConfig = await getPromptFromDB(supabase, 'description_default');
      }
    }

    if (!promptConfig) {
      console.warn(`⚠️ No prompt found, using inline default (Orbit fallback)`);
      promptConfig = {
        id: "default-inline",
        prompt_key: "description_default",
        name: "Descrição padrão",
        system_prompt: `Você é um assistente que gera descrições profissionais de solicitações de serviço para uma plataforma de orçamentos.
Gere uma descrição clara, em português brasileiro, com as seções: RESUMO DO SERVIÇO, DESCRIÇÃO DETALHADA e SUGESTÕES.
Use APENAS as informações fornecidas no contexto. Não invente dados.
Formato: texto puro, sem markdown.`,
        user_prompt_template: null,
        category_slug: null,
        use_case: "description",
        max_tokens: 1500,
        temperature: 0.3,
        variables_schema: {},
        formatting_rules: { use_caps_titles: true, use_block_separation: true, allow_markdown: false, word_limit: 300 },
        version: 1,
      };
    }

    console.log(`✅ Using prompt: ${promptConfig.name} (v${promptConfig.version})`);

    // ========== API KEY VIA ENV (Orbit: no get_active_integration) ==========
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada. Defina o secret no projeto Supabase.");
    }
    const MODEL_NAME = 'gpt-4o-mini';
    const TEMPERATURE: number = promptConfig.temperature;
    const MAX_TOKENS: number = promptConfig.max_tokens;
    console.log(`[Config] Model=${MODEL_NAME}, temp=${TEMPERATURE}, max_tokens=${MAX_TOKENS}`);

    // ========== CONTEXTO (Orbit: sem get_user_context / get_location_context) ==========
    const userContext: Record<string, unknown> = {};
    const locationContext: Record<string, unknown> = {};
    // ========== PREPARAR CONTEXTO ==========
    // Incluir contexto enriquecido (usuário + localização) se disponível
    const context = formatFormDataToContext(
      serviceDisplayName, 
      formData, 
      userNotes,
      additionalDetails, // Texto de "Detalhes Adicionais" da etapa 2
      mode, // Modo para controle de custo
      userContext, // FASE 3: Contexto do usuário
      locationContext, // FASE 3: Contexto de localização
      proposedPrice, // FASE 4: Valor proposto pelo prestador
      providerNotes // FASE 4: Notas do prestador
    );
    
    console.log("📤 Context prepared:", context.substring(0, 200) + "...");
    console.log(`[Mode] ${mode}, [ProposedPrice] R$ ${proposedPrice}, [ProviderNotes] ${providerNotes ? providerNotes.substring(0, 50) + '...' : 'N/A'}, [AdditionalDetails] ${additionalDetails ? 'Sim' : 'Não'}, [UserContext] ${Object.keys(userContext).length > 0 ? 'Sim' : 'Não'}, [LocationContext] ${Object.keys(locationContext).length > 0 ? 'Sim' : 'Não'}`);

    // ========== PREPARAR SYSTEM PROMPT (AJUSTAR BASEADO NO MODO) ==========
    let systemPrompt = promptConfig.system_prompt;
    let userPrompt = context;
    
    // Ajustar prompt baseado no modo
    if (mode === 'suggestion') {
      // MELHORIA 4: Prompt mais restritivo para modo suggestion
      // Objetivo: Gerar texto curto, objetivo, sem saudações ou explicações
      systemPrompt = `Você é um assistente que completa descrições técnicas de serviços.

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

      userPrompt = `Com base nas informações abaixo, sugira um texto curto de "Detalhes Adicionais" que complemente o que já foi informado:

${context}

Sugestão (2-4 frases):`;
      
      // Modo suggestion: não usar structured output
      // Continuar com o fluxo normal, mas sem exigir JSON
    } else if (enableStructured) {
      // CORREÇÃO CRÍTICA: Prompt MUITO mais restritivo para evitar invenção de informações
      // FASE 4: Incluir obrigatoriamente o VALOR e as NOTAS DO PRESTADOR
      systemPrompt = `${systemPrompt}

═══════════════════════════════════════════════════════
⚠️ REGRAS CRÍTICAS - LEIA COM ATENÇÃO ⚠️
═══════════════════════════════════════════════════════

Você é um CONSULTOR DE VENDAS SÊNIOR especializado em ${serviceDisplayName}.
Seu objetivo: Criar uma proposta comercial PERSUASIVA e PERSONALIZADA que convença o cliente a aceitar.

🚫 PROIBIÇÃO ABSOLUTA:
- NÃO use conhecimento geral sobre a categoria de serviço
- NÃO invente problemas, sintomas ou diagnósticos não mencionados
- NÃO adicione informações técnicas que não estão no formulário
- NÃO assuma problemas comuns da categoria se não foram mencionados
- NÃO crie seções como "DIAGNÓSTICO TÉCNICO" se não há problema a diagnosticar
- NÃO mencione normas (NR10, NBR) se não foram mencionadas pelo cliente
- NÃO sugira materiais ou procedimentos não mencionados

✅ O QUE VOCÊ DEVE FAZER:
- Use APENAS as informações fornecidas na seção "CONTEXTO DO FORMULÁRIO"
- Se o cliente mencionou "instalar chuveiro", descreva APENAS instalação de chuveiro
- Se o cliente mencionou "2 pontos", mencione APENAS 2 pontos
- Se o cliente mencionou "emergência", mencione APENAS urgência
- Se o cliente escreveu algo em "Detalhes Adicionais", use EXATAMENTE o que ele escreveu
- Se algo NÃO foi mencionado, NÃO invente

🎯 REGRA DE OURO (FASE 4 - PRESTADOR):
⚠️ VOCÊ ESTÁ CRIANDO UMA PROPOSTA COMERCIAL PARA O PRESTADOR.
⚠️ O PRESTADOR JÁ DEFINIU O VALOR: Use este valor na proposta!
⚠️ O PRESTADOR DESCREVEU SUA ABORDAGEM: Use as notas do prestador como base!
⚠️ SEU TRABALHO: Transformar as notas do prestador em uma proposta profissional e persuasiva.

🔑 INSTRUÇÕES ESPECÍFICAS PARA O CONTEXTO DO PRESTADOR:
1. SEMPRE mencione o valor proposto (R$ XXX) na descrição
2. Justifique por que este valor é justo (use as notas do prestador)
3. Destaque os diferenciais mencionados pelo prestador (materiais, prazos, garantias)
4. Crie um call-to-action ao final ("Aceite minha proposta!")
5. Tom profissional, mas persuasivo e confiante

📋 ESTRUTURA OBRIGATÓRIA DA DESCRIÇÃO (NÃO NEGOCIÁVEL):
A descrição DEVE ter EXATAMENTE estas 3 seções nesta ordem:
1. RESUMO DO SERVIÇO: (OBRIGATÓRIO) Liste TODOS os campos preenchidos
2. DESCRIÇÃO DETALHADA: (OBRIGATÓRIO) Baseada APENAS no resumo acima + notas do prestador
3. SUGESTÕES: (OPCIONAL) Sugestões relevantes

⚠️ NÃO PULE NENHUMA SEÇÃO. NÃO INVENTE SEÇÕES. USE EXATAMENTE ESTA ESTRUTURA.

🌐 IDIOMA OBRIGATÓRIO:
⚠️ TODOS os textos devem estar em PORTUGUÊS BRASILEIRO.
⚠️ Traduza TODOS os valores do formulário para português antes de listar.
⚠️ NÃO use inglês em nenhuma parte da descrição.

═══════════════════════════════════════════════════════
FORMATO DE SAÍDA (JSON ESTRUTURADO)
═══════════════════════════════════════════════════════

IMPORTANTE: Você DEVE retornar APENAS um JSON válido no seguinte formato (sem markdown, sem texto adicional):

{
  "schema_version": 1,
  "professional_description": "Descrição profissional formatada do serviço solicitado (texto puro, sem markdown). Use APENAS informações do formulário.",
  "tags": ["tag1", "tag2", "tag3"],
  "missing_info_warnings": ["Aviso 1", "Aviso 2"],
  "suggested_questions": ["Pergunta 1", "Pergunta 2"],
  "urgency": "low|medium|high",
  "scope_complexity": "simple|medium|complex",
  "confidence": 0.0-1.0,
  "recommended_next_step": "ask_questions|schedule_visit|send_estimate_range"
}

REGRAS DE PREENCHIMENTO (RESTRITIVAS):
- professional_description: 
  * ESTRUTURA OBRIGATÓRIA (com quebras de linha):
    1. RESUMO DO SERVIÇO: Liste TODOS os campos preenchidos no formulário de forma detalhada
    2. DESCRIÇÃO DETALHADA: Descrição completa baseada APENAS no resumo acima + CONTEXTO DO PRESTADOR (valor e notas)
    3. SUGESTÕES: Sugestões relevantes baseadas no que foi informado (se aplicável)
  
  * FORMATO (use quebras de linha \\n):
    "RESUMO DO SERVIÇO:\\n\\n[Liste TODOS os campos: tipo de imóvel, tipo de serviço, quantidade, localização, urgência, etc. - APENAS o que foi preenchido]\\n\\nDESCRIÇÃO DETALHADA:\\n\\n[Proposta comercial personalizada usando o valor R$ XXX e as notas do prestador como base. Justifique o valor e destaque diferenciais.]\\n\\nSUGESTÕES:\\n\\n[Sugestões relevantes, se aplicável]"
  
  * REGRAS CRÍTICAS (NÃO NEGOCIÁVEIS):
    - PASSO 1: Liste TODOS os campos do formulário que foram preenchidos no "RESUMO DO SERVIÇO"
    - PASSO 2: Crie a "DESCRIÇÃO DETALHADA" usando:
      * O resumo (PASSO 1)
      * O VALOR proposto pelo prestador (OBRIGATÓRIO mencionar)
      * As NOTAS do prestador (usar como base para justificar o valor e destacar diferenciais)
    - PASSO 3: Crie "SUGESTÕES" baseadas APENAS no que foi informado
    - SEMPRE mencione o valor na descrição: "Meu orçamento para este serviço é de R$ XXX"
    - SEMPRE use as notas do prestador para criar a proposta (materiais, prazos, garantias mencionados)
    - NÃO invente informações que não estão na lista do PASSO 1 ou nas notas do prestador
    - Use tom profissional mas persuasivo (você está vendendo o serviço!)
  
- tags: Array de tags baseadas APENAS no que foi informado (ex: "urgente" se urgência foi mencionada, "residencial" se tipo de imóvel foi mencionado)
- missing_info_warnings: Array de avisos sobre informações faltantes (ex: "Falta metragem" se metragem não foi informada)
- suggested_questions: Array de perguntas relevantes baseadas no que foi informado
- urgency: "high" se urgência foi marcada como urgente, "medium" se média, "low" se baixa
- scope_complexity: "simple" se quantidade pequena (1-2 pontos), "medium" se média (3-5), "complex" se grande (6+)
- confidence: 0.0-1.0 baseado na completude das informações fornecidas
- recommended_next_step: "ask_questions" se há informações faltantes críticas, "send_estimate_range" se informações estão completas

EXEMPLO CORRETO (instalação de chuveiro com contexto do prestador):
{
  "professional_description": "RESUMO DO SERVIÇO:\\n\\nTipo de imóvel: Casa\\nTipo de serviço: Instalação de Chuveiro Elétrico\\nQuantidade: 2 pontos\\nTipo de parede: Alvenaria\\nVoltagem: 220V\\nAltura do teto: Alto (3-4m)\\nUrgência: Emergência\\nDetalhes adicionais: Cliente precisa instalar 2 chuveiros pois os anteriores queimaram. Verificar necessidade de extensor.\\n\\nDESCRIÇÃO DETALHADA:\\n\\nMeu orçamento para a instalação de 2 chuveiros elétricos é de R$ 450,00. Este valor inclui mão de obra especializada, materiais de qualidade (disjuntores 40A, fiação 6mm², conectores), e garantia de 90 dias do serviço. Como profissional certificado, vou verificar toda a instalação elétrica prévia, garantir aterramento adequado e testar a pressão da água. Por se tratar de emergência, posso realizar o serviço ainda hoje. Utilizo apenas materiais certificados pelo Inmetro e sigo rigorosamente as normas de segurança. O valor é justo considerando a urgência, a altura do teto (que requer escada telescópica) e a qualidade dos materiais que utilizo.\\n\\nSUGESTÕES:\\n\\nRecomendo verificar se há disjuntor exclusivo para chuveiro. Se não houver, sugiro instalação para maior segurança (custo adicional de R$ 80).",
  "tags": ["urgente", "residencial", "instalação", "emergência"],
  "missing_info_warnings": [],
  "suggested_questions": ["Os chuveiros anteriores eram 220V?", "Há fiação elétrica no local?"],
  "urgency": "high",
  "scope_complexity": "simple",
  "confidence": 0.9,
  "recommended_next_step": "send_estimate_range"
}

EXEMPLO ERRADO (NÃO FAÇA ISSO):
{
  "professional_description": "RESUMO: Vazamento em tubulação de água quente... [INVENTADO - não foi mencionado 'água quente']",
  ...
}

Retorne APENAS o JSON, sem explicações adicionais.`;

      userPrompt = `═══════════════════════════════════════════════════════
INSTRUÇÕES OBRIGATÓRIAS - SIGA EXATAMENTE ESTA ORDEM:
═══════════════════════════════════════════════════════

⚠️ IMPORTANTE: Todos os textos devem estar em PORTUGUÊS BRASILEIRO.

🎯 CONTEXTO: Você está criando uma PROPOSTA COMERCIAL para o prestador.
- O prestador JÁ definiu o VALOR: R$ ${proposedPrice?.toFixed(2) || '___'}
- O prestador JÁ descreveu SUA ABORDAGEM nas notas abaixo
- Seu trabalho: Criar uma proposta profissional e PERSUASIVA

PASSO 1: Crie a seção "RESUMO DO SERVIÇO"
- Liste TODOS os campos preenchidos no formulário abaixo
- Use o formato: "Nome do campo: Valor do campo"
- Traduza TODOS os valores para português (ex: "emergency" → "Emergência", "bathroom" → "Banheiro")
- NÃO invente campos que não existem
- NÃO invente valores que não foram preenchidos
- Se o campo não foi preenchido, NÃO liste ele

PASSO 2: Crie a seção "DESCRIÇÃO DETALHADA" (PROPOSTA COMERCIAL)
- Baseie APENAS nas informações que você listou no PASSO 1 + CONTEXTO DO PRESTADOR
- OBRIGATÓRIO: Mencione o valor: "Meu orçamento para este serviço é de R$ ${proposedPrice?.toFixed(2) || '___'}"
- OBRIGATÓRIO: Justifique o valor usando as notas do prestador (materiais, prazos, garantias)
- Use APENAS português brasileiro
- Tom profissional mas persuasivo (você está vendendo!)
- Destaque diferenciais mencionados pelo prestador
- NÃO adicione informações que não estão no resumo ou nas notas do prestador
- NÃO invente problemas, diagnósticos ou procedimentos

PASSO 3: Crie a seção "SUGESTÕES"
- Sugestões relevantes baseadas APENAS no que foi informado
- Use APENAS português brasileiro
- NÃO invente sugestões sobre coisas não mencionadas

═══════════════════════════════════════════════════════
FORMATO OBRIGATÓRIO (use \\n para quebras de linha):
═══════════════════════════════════════════════════════

"RESUMO DO SERVIÇO:\\n\\n[lista de TODOS os campos preenchidos - EM PORTUGUÊS]\\n\\nDESCRIÇÃO DETALHADA:\\n\\n[Proposta comercial personalizada que OBRIGATORIAMENTE mencione o valor R$ ${proposedPrice?.toFixed(2) || '___'} e use as notas do prestador para justificar e destacar diferenciais - EM PORTUGUÊS]\\n\\nSUGESTÕES:\\n\\n[sugestões relevantes - EM PORTUGUÊS]"

═══════════════════════════════════════════════════════
DADOS DO FORMULÁRIO:
═══════════════════════════════════════════════════════

${context}

═══════════════════════════════════════════════════════
RETORNE O JSON:
═══════════════════════════════════════════════════════

Retorne o JSON com professional_description seguindo EXATAMENTE o formato acima.
⚠️ TODOS os textos devem estar em PORTUGUÊS BRASILEIRO.
⚠️ OBRIGATÓRIO mencionar o valor R$ ${proposedPrice?.toFixed(2) || '___'} na descrição.
⚠️ OBRIGATÓRIO usar as notas do prestador como base para a proposta.
NÃO pule nenhuma seção. NÃO invente informações.`;
    }

    // ========== CHAMAR OPENAI ==========
    // CORREÇÃO: Reduzir temperatura para modo structured para garantir que siga instruções
    const finalTemperature = enableStructured ? Math.min(TEMPERATURE, 0.3) : TEMPERATURE;
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: MAX_TOKENS,
        temperature: finalTemperature,
        ...(enableStructured ? { response_format: { type: "json_object" } } : {}), // Forçar JSON se suportado
      }),
    });
    
    console.log(`[OpenAI] Model: ${MODEL_NAME}, Temperature: ${finalTemperature} (${enableStructured ? 'structured' : 'normal'})`);
    
    const generationTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenAI API error:", response.status, errorText);
      
      await logPromptUsage(
        supabase, 
        promptConfig.id, 
        userId, 
        requestId, 
        false, 
        undefined, 
        generationTime, 
        `OpenAI ${response.status}: ${errorText.substring(0, 200)}`
      );
      
      throw new Error("Erro ao gerar descrição com a IA");
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens;
    
    // ========== PROCESSAR RESPOSTA (FASE 3: JSON estruturado ou texto) ==========
    let structuredResponse: StructuredAIResponse | null = null;
    let processedDescription: string = '';
    
    // Modo 'suggestion' sempre retorna apenas texto
    if (mode === 'suggestion') {
      processedDescription = postProcessDescription(rawContent, serviceDisplayName, promptConfig.formatting_rules);
      console.log(`[Mode: suggestion] ✅ Texto sugerido gerado: ${processedDescription.length} chars`);
    } else if (enableStructured) {
      // Tentar parsear como JSON
      try {
        const parsed = JSON.parse(rawContent);
        structuredResponse = validateStructuredResponse(parsed);
        
        if (structuredResponse) {
          // Orbit: no whitelist from settings; normalizeTags(tags) keeps tags as-is
          structuredResponse.tags = normalizeTags(structuredResponse.tags);
          
          // CORREÇÃO: Garantir formatação correta com quebras de linha
          processedDescription = formatProfessionalDescription(structuredResponse.professional_description);
          
          // CORREÇÃO CRÍTICA: Validar se a estrutura obrigatória está presente
          const hasResumo = processedDescription.includes('RESUMO DO SERVIÇO');
          const hasDescricao = processedDescription.includes('DESCRIÇÃO DETALHADA');
          
          if (!hasResumo || !hasDescricao) {
            console.warn('[FASE3] ⚠️ Estrutura obrigatória não encontrada! Reformatando...');
            // Tentar reformatar adicionando estrutura se não estiver presente
            if (!hasResumo) {
              // Se não tem resumo, tentar criar um baseado no formData
              const resumoSection = 'RESUMO DO SERVIÇO:\n\n[Liste os campos preenchidos aqui]\n\n';
              processedDescription = resumoSection + processedDescription;
            }
            if (!hasDescricao) {
              processedDescription = processedDescription.replace(
                /(RESUMO DO SERVIÇO:[\s\S]*?)(?=SUGESTÕES:|$)/,
                '$1\n\nDESCRIÇÃO DETALHADA:\n\n'
              );
            }
            processedDescription = formatProfessionalDescription(processedDescription);
          }
          
          console.log(`[FASE3] ✅ JSON estruturado validado: ${structuredResponse.tags.length} tags, ${structuredResponse.missing_info_warnings.length} warnings`);
        } else {
          console.warn('[FASE3] ⚠️ JSON inválido, usando fallback');
          processedDescription = postProcessDescription(rawContent, serviceDisplayName, promptConfig.formatting_rules);
          structuredResponse = generateFallbackResponse(processedDescription, serviceDisplayName);
        }
      } catch (parseError) {
        console.warn('[FASE3] ⚠️ Erro ao parsear JSON, usando fallback:', parseError);
        processedDescription = postProcessDescription(rawContent, serviceDisplayName, promptConfig.formatting_rules);
        structuredResponse = generateFallbackResponse(processedDescription, serviceDisplayName);
      }
    } else {
      // Modo 'full_description' sem structured output: apenas texto formatado
      processedDescription = postProcessDescription(
        rawContent,
        serviceDisplayName,
        promptConfig.formatting_rules
      );
      console.log(`[Mode: full_description] ✅ Descrição gerada: ${processedDescription.length} chars`);
    }
    
    console.log(`✅ Generated in ${generationTime}ms, ${tokensUsed} tokens, ${processedDescription.length} chars`);

    // ========== PERSISTIR EM service_requests (FASE 3) ==========
    if (requestId && structuredResponse) {
      try {
        const { error: updateError } = await supabase
          .from('service_requests')
          .update({
            ai_metadata: structuredResponse,
            ai_professional_description: processedDescription,
            ai_generated_at: new Date().toISOString(),
          })
          .eq('id', requestId);
        
        if (updateError) {
          console.warn('[FASE3] ⚠️ Erro ao persistir AI metadata:', updateError);
        } else {
          console.log('[FASE3] ✅ AI metadata persistido em service_requests');
        }
      } catch (persistError) {
        console.warn('[FASE3] ⚠️ Exception ao persistir:', persistError);
      }
    }

    // Log de uso para analytics
    await logPromptUsage(
      supabase, 
      promptConfig.id, 
      userId, 
      requestId, 
      true, 
      tokensUsed, 
      generationTime
    );

    // ========== RETURN RESPONSE ==========
    const responseData: {
      description: string;
      metadata: Record<string, unknown>;
      structured?: StructuredAIResponse;
    } = {
      description: processedDescription,
      metadata: {
        prompt_key: promptConfig.prompt_key,
        prompt_version: promptConfig.version,
        tokens_used: tokensUsed,
        generation_time_ms: generationTime,
        raw_length: rawContent.length,
        processed_length: processedDescription.length,
        is_test: isTestMode,
        mode: mode,
        structured: enableStructured && mode !== 'suggestion',
      },
    };
    
    if (structuredResponse && mode === 'full_description') {
      responseData.structured = structuredResponse;
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const generationTime = Date.now() - startTime;
    const errMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ Error:", errMessage);

    if (promptConfig) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await logPromptUsage(
        supabase, 
        promptConfig.id, 
        userId, 
        null, 
        false, 
        undefined, 
        generationTime, 
        errMessage
      );
    }

    const serviceFallback = parsedServiceId ?? 'serviço';
    const fallback = generateFallbackResponse(
      `Erro ao gerar descrição: ${errMessage}`,
      serviceFallback
    );
    
    return new Response(
      JSON.stringify({ 
        error: errMessage,
        hint: "Verifique a configuração no painel admin ou tente novamente",
        description: fallback.professional_description,
        structured: fallback,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
