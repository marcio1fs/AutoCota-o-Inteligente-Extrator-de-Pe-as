
import { GoogleGenAI, Type } from "@google/genai";
import { QuoteItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

export const extractQuotesFromText = async (text: string, file?: FileData): Promise<QuoteItem[]> => {
  try {
    const parts: any[] = [{ text: `Extraia as cotações deste conteúdo:\n\n${text}` }];
    
    if (file) {
      // Garantir que não estamos enviando tipos MIME não suportados pela API binária
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
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: `Você é um analista de peças automotivas sênior.
OBJETIVO: Extrair cotações estruturadas para comparação de Tiers de qualidade.

REGRAS DE OURO:
1. MARCAS PREMIUM: Identifique e destaque Bosch, TRW, ATE, Mahle, LUK, Cofap, Fremax, etc.
2. LIMPEZA: No campo 'nome_produto', remova marcas e códigos. Ex: 'Disco Freio Diant TRW RP123' vira 'Disco de Freio Dianteiro'.
3. FORNECEDOR: Identifique o nome da loja ou empresa. Se houver vários no mesmo texto ou imagem, agrupe corretamente.
4. NÚMEROS: Preços devem ser números decimais simples. Use ponto (.) como separador decimal.
5. DADOS DE PLANILHA: Se o texto contiver dados CSV ou tabelas, interprete as colunas de descrição, fabricante e preço unitário.
6. DOCUMENTOS: Se houver uma imagem ou PDF, analise visualmente a tabela de preços.`,
        responseMimeType: "application/json",
        responseSchema: QUOTE_SCHEMA,
      },
    });

    const rawJson = response.text || "[]";
    const items: Omit<QuoteItem, "id">[] = JSON.parse(rawJson);
    
    return items.map((item, index) => ({
      ...item,
      id: `${Date.now()}-${index}`,
    }));
  } catch (error) {
    console.error("Falha na extração:", error);
    throw new Error("Não foi possível processar o conteúdo. Verifique se o arquivo é legível e tente novamente.");
  }
};
