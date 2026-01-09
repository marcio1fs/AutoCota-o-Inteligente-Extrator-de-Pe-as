
import { GoogleGenAI, Type } from "@google/genai";
import { QuoteItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const QUOTE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      nome_produto: {
        type: Type.STRING,
        description: "Descrição limpa do produto (ex: Kit Embreagem). Remova códigos e marcas do nome.",
        nullable: true
      },
      marca: {
        type: Type.STRING,
        description: "Marca do fabricante (ex: LUK, TRW, Bosch, FAG).",
        nullable: true
      },
      nome_fornecedor: {
        type: Type.STRING,
        description: "Nome da empresa que enviou a cotação.",
        nullable: true
      },
      preco_unitario: {
        type: Type.NUMBER,
        description: "Valor unitário decimal.",
        nullable: true
      },
    },
    required: ["nome_produto", "marca", "nome_fornecedor", "preco_unitario"],
  },
};

export const extractQuotesFromText = async (text: string): Promise<QuoteItem[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `### TEXTO DA COTAÇÃO ###\n"""\n${text}\n"""\n\nExtraia os itens seguindo as regras de marcas e limpeza de nomes.`,
      config: {
        systemInstruction: `Você é um especialista em peças automotivas. 
Sua tarefa é extrair cotações de textos brutos.

### REGRAS CRÍTICAS DE MARCAS ###
1. Identifique marcas de primeira linha: Bosch, TRW, ATE, Metal Leve (Mahle), INA, FAG, LUK, Cofap, Monroe, Nakata, Magneti Marelli, Fremax, Mann-Filter.
2. Se a marca estiver no nome do produto, mova-a para o campo 'marca' e limpe o 'nome_produto'.

### FORMATAÇÃO ###
- nome_produto: Apenas a descrição (ex: 'Disco de Freio' em vez de 'Disco Freio TRW 302mm').
- marca: Nome da fabricante. Se não encontrar, use null.
- preco_unitario: Apenas números decimais (use ponto).
- Se houver múltiplos fornecedores no mesmo texto, separe os itens corretamente por fornecedor.`,
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
    console.error("Erro na extração Gemini:", error);
    throw new Error("Falha ao processar a cotação. Verifique o texto e tente novamente.");
  }
};
