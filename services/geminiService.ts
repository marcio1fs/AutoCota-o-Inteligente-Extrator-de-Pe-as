
import { GoogleGenAI, Type } from "@google/genai";
import { QuoteItem } from "../types";

const env = (import.meta as any).env || {};
const geminiApiKey = env.VITE_GEMINI_API_KEY || env.VITE_API_KEY || '';
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
const openRouterApiKey = env.VITE_OPENROUTER_API_KEY || '';
const openRouterModel = env.VITE_OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

const QUOTE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      nome_produto: {
        type: Type.STRING,
        description: "Descrição limpa do produto (ex: Kit Embreagem). Remova códigos e marcas.",
      },
      marca: {
        type: Type.STRING,
        description: "Fabricante (ex: LUK, TRW, Bosch, FAG).",
      },
      nome_fornecedor: {
        type: Type.STRING,
        description: "Empresa que enviou o orçamento.",
      },
      email_fornecedor: {
        type: Type.STRING,
        description: "Email do fornecedor para contato, se disponível no documento.",
      },
      telefone_fornecedor: {
        type: Type.STRING,
        description: "Telefone do fornecedor para contato, se disponível no documento.",
      },
      preco_unitario: {
        type: Type.NUMBER,
        description: "Valor unitário decimal puro.",
      },
    },
    required: ["nome_produto", "marca", "nome_fornecedor", "preco_unitario"],
  },
};

export interface FileData {
  base64: string;
  mimeType: string;
}

export type GeminiValidationStatus = 'valid' | 'invalid' | 'missing' | 'quota' | 'error';

export interface GeminiValidationResult {
  valid: boolean;
  status: GeminiValidationStatus;
  message: string;
  retryAfterSeconds?: number;
}

let validationCache: { expiresAt: number; result: GeminiValidationResult } | null = null;

const parseRetryAfterSeconds = (rawMessage: string): number | undefined => {
  const retryInMatch = rawMessage.match(/retry in\s+([\d.]+)s/i);
  if (retryInMatch?.[1]) return Math.max(1, Math.ceil(Number(retryInMatch[1])));

  const retryDelayMatch = rawMessage.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (retryDelayMatch?.[1]) return Math.max(1, Number(retryDelayMatch[1]));

  return undefined;
};

const isQuotaExceededError = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes('resource_exhausted') ||
    lower.includes('quota exceeded') ||
    lower.includes('429')
  );
};

const normalizeExtractedItems = (rawItems: Partial<QuoteItem>[]) => {
  return rawItems.map((item: Partial<QuoteItem>, index: number) => ({
    id: `${Date.now()}-${index}`,
    nome_produto: item.nome_produto || 'Peça Automotiva',
    codigo_referencia: item.codigo_referencia || null,
    marca: item.marca || 'Genérica',
    nome_fornecedor: item.nome_fornecedor || 'Fornecedor Padrão',
    email_fornecedor: item.email_fornecedor || null,
    telefone_fornecedor: item.telefone_fornecedor || null,
    preco_unitario: Number(item.preco_unitario || 0),
    selected: false,
  }));
};

const extractWithGemini = async (text: string, file?: FileData): Promise<QuoteItem[]> => {
  if (!ai || !geminiApiKey) return [];

  const parts: any[] = [{ text: `Extraia os itens de cotação em JSON válido a partir do conteúdo abaixo:\n\n${text}` }];

  if (file) {
    const supportedBinaryTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
    if (supportedBinaryTypes.includes(file.mimeType)) {
      parts.push({
        inlineData: {
          data: file.base64,
          mimeType: file.mimeType
        }
      });
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts },
    config: {
      systemInstruction: `Você é um analista de cotações automotivas.
- Retorne apenas JSON válido, sem markdown.
- Remova ruídos de OCR e normalize preços.
- Identifique fornecedor, produto, marca e preço unitário.` ,
      responseMimeType: 'application/json',
      responseSchema: QUOTE_SCHEMA,
    },
  });

  const rawJson = (response as any)?.text || '[]';
  const aiItems = JSON.parse(rawJson);
  if (!Array.isArray(aiItems) || aiItems.length === 0) return [];

  return normalizeExtractedItems(aiItems);
};

const extractWithOpenRouter = async (text: string): Promise<QuoteItem[]> => {
  if (!openRouterApiKey) return [];

  const instruction = [
    'Extraia itens de cotação automotiva e devolva APENAS JSON válido.',
    'Formato esperado: array de objetos com os campos:',
    'nome_produto, marca, nome_fornecedor, preco_unitario, codigo_referencia, email_fornecedor, telefone_fornecedor.',
    'Sem markdown, sem explicações, sem texto fora do JSON.',
    'Preço deve ser número decimal (não string).',
  ].join('\n');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openRouterApiKey}`,
    },
    body: JSON.stringify({
      model: openRouterModel,
      temperature: 0,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenRouter error ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content);
  const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
  if (!Array.isArray(items) || items.length === 0) return [];

  return normalizeExtractedItems(items);
};

export const validateGeminiApiKey = async (): Promise<GeminiValidationResult> => {
  if (validationCache && Date.now() < validationCache.expiresAt) {
    return validationCache.result;
  }

  if (!geminiApiKey) {
    if (openRouterApiKey) {
      return {
        valid: true,
        status: 'missing',
        message: 'Gemini não configurado, mas fallback OpenRouter está ativo.',
      };
    }

    return { valid: false, status: 'missing', message: 'Chave não configurada em VITE_GEMINI_API_KEY.' };
  }

  if (!ai) {
    return { valid: false, status: 'error', message: 'Falha ao inicializar cliente Gemini.' };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: 'Responda apenas: OK' }] },
      config: {
        temperature: 0,
        maxOutputTokens: 4,
      },
    });

    const text = ((response as any)?.text || '').toString().trim();
    const successResult: GeminiValidationResult = !text
      ? { valid: true, status: 'valid', message: 'Chave válida (resposta recebida do Gemini).' }
      : { valid: true, status: 'valid', message: `Chave válida (Gemini respondeu: ${text.slice(0, 30)}).` };

    validationCache = {
      result: successResult,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    return successResult;
  } catch (error: any) {
    const message = (error?.message || '').toString();
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('resource_exhausted') ||
      lowerMessage.includes('quota exceeded') ||
      lowerMessage.includes('429')
    ) {
      const retryAfterSeconds = parseRetryAfterSeconds(message);
      const quotaResult: GeminiValidationResult = {
        valid: true,
        status: 'quota',
        retryAfterSeconds,
        message: retryAfterSeconds
          ? `Chave válida, mas cota excedida. Tente novamente em ~${retryAfterSeconds}s.`
          : 'Chave válida, mas cota excedida no Gemini. Aguarde e tente novamente.',
      };

      validationCache = {
        result: quotaResult,
        expiresAt: Date.now() + Math.max(15, (retryAfterSeconds || 20)) * 1000,
      };

      return quotaResult;
    }

    if (message.includes('API key not valid') || message.includes('PERMISSION_DENIED') || message.includes('401') || message.includes('403')) {
      return { valid: false, status: 'invalid', message: 'Chave inválida ou sem permissão para o modelo.' };
    }

    return { valid: false, status: 'error', message: `Falha ao validar chave: ${message || 'erro desconhecido'}` };
  }
};

export const extractQuotesFromText = async (text: string, file?: FileData): Promise<QuoteItem[]> => {
  const debugEnabled = env.VITE_DEBUG_LOGS === 'true';

  const structuredItems = parseStructuredQuoteRows(text);
  if (structuredItems.length > 0) return structuredItems;

  let geminiErrorMessage = '';
  try {
    const geminiItems = await extractWithGemini(text, file);
    if (geminiItems.length > 0) return geminiItems;
  } catch (error: any) {
    geminiErrorMessage = (error?.message || '').toString();
    if (debugEnabled) {
      console.warn('[debug] Falha na extração com Gemini; usando parser manual.', error);
    }
  }

  if (openRouterApiKey) {
    try {
      const openRouterItems = await extractWithOpenRouter(text);
      if (openRouterItems.length > 0) {
        if (debugEnabled) {
          const reason = geminiErrorMessage
            ? isQuotaExceededError(geminiErrorMessage)
              ? 'quota/limite do Gemini'
              : 'falha no Gemini'
            : 'resposta vazia do Gemini';
          console.info(`[debug] Extração realizada com OpenRouter (fallback por ${reason}).`);
        }
        return openRouterItems;
      }
    } catch (error) {
      if (debugEnabled) {
        console.warn('[debug] Falha na extração com OpenRouter fallback; usando parser manual.', error);
      }
    }
  }

  return parseQuotesManually(text);
};

const normalizeHeader = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

const toNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const sanitized = value
    .replace(/r\$|\s/gi, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
};

const pick = (row: Record<string, string>, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim()) return value.trim();
  }
  return '';
};

function parseStructuredQuoteRows(text: string): QuoteItem[] {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('--- Planilha:'));

  if (lines.length < 2) return [];

  const headerIndex = lines.findIndex(line => {
    const header = normalizeHeader(line);
    return header.includes('fornecedor') && (header.includes('precounitario') || header.includes('preco'));
  });

  if (headerIndex < 0) return [];

  const headerLine = lines[headerIndex];
  const delimiter = (headerLine.split(';').length > headerLine.split(',').length) ? ';' : ',';
  const rawHeaders = headerLine.split(delimiter).map(h => h.trim());
  const headers = rawHeaders.map(normalizeHeader);

  const items: QuoteItem[] = [];
  const now = Date.now();

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.includes(delimiter)) continue;

    const cols = line.split(delimiter).map(c => c.trim());
    if (cols.length < 3) continue;

    const row: Record<string, string> = {};
    headers.forEach((key, idx) => {
      row[key] = cols[idx] ?? '';
    });

    const preco = toNumber(pick(row, ['precounitario', 'preco', 'valorunitario', 'valor']));
    if (preco === null) continue;

    const fornecedor = pick(row, ['fornecedor', 'nomefornecedor', 'empresa']) || 'Fornecedor Padrão';
    const itemId = pick(row, ['itemid', 'iditem', 'codigoitem']) || null;
    const itemBase = pick(row, ['itembase', 'descricao', 'descricaoproduto', 'produto', 'nomeproduto']) || null;
    const descricao = pick(row, ['descricaoproduto', 'descricao', 'produto', 'nomeproduto']) || itemBase || 'Peça Automotiva';
    const referencia = pick(row, ['codigoreferencia', 'referencia', 'codigo', 'cod']) || null;
    const marca = pick(row, ['marca', 'fabricante']) || 'Genérica';
    const marcaDesejada = pick(row, ['marcadesejada', 'desejada', 'marcareferencia']) || null;

    items.push({
      id: `${now}-${i}-${items.length}`,
      item_id: itemId,
      item_base: itemBase,
      nome_produto: descricao,
      codigo_referencia: referencia,
      marca,
      marca_desejada: marcaDesejada,
      nome_fornecedor: fornecedor,
      preco_unitario: preco,
      selected: false,
    });
  }

  return items;
}

// Parser manual simples para demonstração
function parseQuotesManually(text: string): QuoteItem[] {
  const items: QuoteItem[] = [];
  
  // Exemplos de padrões comuns em cotações
  // Formato: "Produto - Marca - Fornecedor - R$ 100,00"
  // ou tabelas CSV de Excel
  
  const lines = text.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Tentar extrair preço (R$ ou apenas números)
    const precoMatch = line.match(/R?\$?\s?(\d+[,.]?\d+)/);
    if (!precoMatch) continue;
    
    const preco = parseFloat(precoMatch[1].replace(',', '.'));
    if (isNaN(preco) || preco === 0) continue;
    
    // Tentar extrair código/referência (padrões alfanuméricos comuns)
    // Exemplos: AB123, 12345, AB-123-CD, REF123, 123.456
    const codigoMatch = line.match(/\b([A-Z0-9]{3,}[-.]?[A-Z0-9]*|REF[:\s]?[A-Z0-9-]+|COD[:\s]?[A-Z0-9-]+|\d{4,})\b/i);
    const codigoReferencia = codigoMatch ? codigoMatch[1] : null;
    
    // Tentar identificar marca (palavras conhecidas)
    const marcasComuns = ['BOSCH', 'TRW', 'LUK', 'MAHLE', 'COFAP', 'ATE', 'FREMAX', 'FAG', 'CONTINENTAL', 'GATES', 'NGK', 'MOBIL'];
    let marca = 'Genérica';
    const lineUpper = line.toUpperCase();
    for (const m of marcasComuns) {
      if (lineUpper.includes(m)) {
        marca = m.charAt(0) + m.slice(1).toLowerCase();
        break;
      }
    }
    
    // Nome do produto - pegar a primeira parte antes do preço
    let nomeProduto = line.split(/R?\$?\s?\d+/)[0].trim();
    nomeProduto = nomeProduto.replace(new RegExp(marca, 'gi'), '').trim();
    // Remove código da descrição se foi encontrado
    if (codigoReferencia) {
      nomeProduto = nomeProduto.replace(new RegExp(codigoReferencia, 'gi'), '').trim();
    }
    nomeProduto = nomeProduto.replace(/[-_,;]/g, ' ').replace(/\s+/g, ' ').trim();
    if (nomeProduto.length < 3) nomeProduto = 'Peça Automotiva';
    
    items.push({
      id: `${Date.now()}-${items.length}`,
      item_base: line.trim(),
      nome_produto: nomeProduto,
      codigo_referencia: codigoReferencia,
      marca: marca,
      nome_fornecedor: 'Fornecedor Padrão',
      preco_unitario: preco,
      selected: false,
    });
  }
  
  // Sem resultados válidos, retorna lista vazia para evitar dados fictícios.
  if (items.length === 0) {
    return [];
  }
  
  return items;
}
