import { QuoteItem } from '../types';
import { z } from 'zod';
import { getAuthHeaders } from './authService';

let xlsxPromise: Promise<typeof import('xlsx')> | null = null;

const loadXLSX = async () => {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx');
  }
  return xlsxPromise;
};

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || '/api';

const normalizeQuantity = (value?: number | null) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(Number(value)));
};

const EmailItemSchema = z.object({
  nome_produto: z.string().nullable().optional(),
  codigo_referencia: z.string().nullable().optional(),
  marca: z.string().nullable().optional(),
  nome_fornecedor: z.string().nullable().optional(),
  email_fornecedor: z.string().nullable().optional(),
  telefone_fornecedor: z.string().nullable().optional(),
  preco_unitario: z.number().nullable().optional(),
  quantidade: z.number().int().min(1).nullable().optional(),
});

const EmailPayloadSchema = z.object({
  to_email: z.string().email('Email de destino inválido'),
  to_name: z.string().min(1, 'Nome do destinatário é obrigatório'),
  from_name: z.string().min(1, 'Seu nome é obrigatório'),
  subject: z.string().min(1, 'Assunto é obrigatório'),
  message: z.string().min(1, 'Mensagem é obrigatória'),
  items: z.array(EmailItemSchema).min(1, 'Adicione pelo menos um item para enviar')
});

export const generateMailtoLink = (
  supplierName: string,
  supplierEmail: string | null | undefined,
  items: QuoteItem[]
): string => {
  const email = supplierEmail || '';
  const subject = encodeURIComponent(`Pedido de Peças - ${supplierName}`);
  
  const total = items.reduce((sum, item) => {
    const quantity = normalizeQuantity(item.quantidade);
    return sum + (item.preco_unitario || 0) * quantity;
  }, 0);
  
  let body = `Olá, gostaria de fechar o pedido para os seguintes itens:\n\n`;
  
  items.forEach(item => {
    const quantity = normalizeQuantity(item.quantidade);
    const unitPrice = item.preco_unitario || 0;
    body += `- ${item.nome_produto} (${item.marca || 'N/A'}) | Qtd: ${quantity} | Unit: R$ ${unitPrice.toFixed(2)} | Total: R$ ${(unitPrice * quantity).toFixed(2)}\n`;
  });
  
  body += `\nTotal Estimado: R$ ${total.toFixed(2)}\n\n`;
  body += `Por favor, confirmem a disponibilidade e o prazo de entrega.\n`;
  body += `Anexo, envio a planilha de cotação.\n\n`;
  body += `Atenciosamente,`;

  return `mailto:${email}?subject=${subject}&body=${encodeURIComponent(body)}`;
};

/**
 * Gera arquivo Excel em Base64 para anexar ao email
 */
export const generateExcelBase64 = async (items: QuoteItem[], supplierName?: string): Promise<string> => {
  const XLSX = await loadXLSX();
  const workbook = XLSX.utils.book_new();
  
  const data = items.map(item => ({
    'PRODUTO': item.nome_produto,
    'CÓDIGO/REF': item.codigo_referencia || 'N/A',
    'MARCA': item.marca || 'N/A',
    'FORNECEDOR': item.nome_fornecedor || 'Desconhecido',
    'PREÇO UNIT. (R$)': item.preco_unitario,
    'EMAIL': item.email_fornecedor || '',
    'TELEFONE': item.telefone_fornecedor || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const total = items.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);

  XLSX.utils.sheet_add_aoa(worksheet, [
    [],
    ['', '', '', '', 'TOTAL:', total]
  ], { origin: -1 });

  worksheet['!cols'] = [
    { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 15 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cotação');
  
  // Gera o arquivo em formato binário
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
};

export interface EmailData {
  to_email: string;
  to_name: string;
  from_name: string;
  subject: string;
  message: string;
  items: QuoteItem[];
}

/**
 * Envia email com cotação via backend SMTP (fluxo corporativo)
 */
export const sendQuoteEmail = async (emailData: EmailData): Promise<{ success: boolean; message: string }> => {
  try {
    const parsed = EmailPayloadSchema.safeParse(emailData);
    if (!parsed.success) {
      return { success: false, message: `❌ ${parsed.error.issues[0]?.message || 'Dados inválidos.'}` };
    }

    const apiResponse = await fetch(`${BACKEND_API_URL}/send-quote-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(parsed.data)
    });

    if (apiResponse.status === 401) {
      return {
        success: false,
        message: '❌ Sessão expirada ou não autenticada. Faça login novamente.',
      };
    }

    if (apiResponse.ok) {
      const apiResult = await apiResponse.json();
      return {
        success: true,
        message: `✅ ${apiResult.message || 'Email enviado com anexo Excel pelo backend.'}`
      };
    }

    const backendError = await apiResponse.json().catch(() => null);
    return {
      success: false,
      message: `❌ Falha no envio via backend SMTP.\n\n${backendError?.message || 'Verifique se o backend está ativo em npm run dev:server e as variáveis SMTP estão corretas.'}`
    };
  } catch (error: any) {
    console.error('❌ Erro ao enviar email:', error);

    const errorMessage = error.message?.includes('network') || error.message?.includes('fetch')
      ? '❌ Erro de conexão com o backend. Verifique se `npm run dev:server` está em execução.'
      : `❌ Erro no envio SMTP: ${error.message || 'Erro desconhecido'}`;

    return { 
      success: false, 
      message: errorMessage
    };
  }
};
