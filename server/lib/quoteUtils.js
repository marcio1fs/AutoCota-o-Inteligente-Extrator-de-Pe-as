import { z } from 'zod';

export const QuoteItemSchema = z.object({
  nome_produto: z.string().nullable().optional(),
  codigo_referencia: z.string().nullable().optional(),
  marca: z.string().nullable().optional(),
  preco_unitario: z.number().nullable().optional(),
  nome_fornecedor: z.string().nullable().optional(),
  quantidade: z.number().int().min(1).nullable().optional(),
});

export const EmailPayloadSchema = z.object({
  to_email: z.string().email(),
  to_name: z.string().min(1),
  from_name: z.string().min(1),
  subject: z.string().min(1),
  message: z.string().min(1),
  items: z.array(QuoteItemSchema).min(1),
});

export const normalizeQuoteItem = (item) => {
  const produto = (item?.nome_produto || 'Peça Automotiva').toString().trim();
  const referencia = (item?.codigo_referencia || '').toString().trim();
  const marca = (item?.marca || 'N/A').toString().trim();
  const preco = Number(item?.preco_unitario || 0);
  const quantidade = Number(item?.quantidade || 1);
  const unitPrice = Number.isFinite(preco) ? Math.max(0, preco) : 0;

  return {
    nome_produto: produto,
    codigo_referencia: referencia || 'N/A',
    marca,
    preco_unitario: Math.round(unitPrice * 100) / 100,
    quantidade: Number.isFinite(quantidade) ? Math.max(1, Math.floor(quantidade)) : 1,
    nome_fornecedor: (item?.nome_fornecedor || 'Desconhecido').toString().trim(),
  };
};

export const buildEmailText = (payload) => {
  const total = payload.items.reduce((sum, item) => {
    const quantidade = Math.max(1, Math.floor(item?.quantidade || 1));
    const unitario = Math.max(0, Number(item.preco_unitario || 0));
    return sum + unitario * quantidade;
  }, 0);
  const roundedTotal = Math.round(total * 100) / 100;
  const list = payload.items
    .map((item) => {
      const quantidade = Math.max(1, Math.floor(item?.quantidade || 1));
      const unitario = Math.max(0, Number(item.preco_unitario || 0));
      const totalLinha = Math.round(unitario * quantidade * 100) / 100;
      return `• ${item.nome_produto || 'Peça'} | Ref: ${item.codigo_referencia || 'N/A'} | ${item.marca || 'N/A'} | Qtd: ${quantidade} | R$ ${unitario.toFixed(2)} | Total: R$ ${totalLinha.toFixed(2)}`;
    })
    .join('\n');

  return `${payload.message}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 ITENS DA COTAÇÃO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${list}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💰 TOTAL: R$ ${roundedTotal.toFixed(2)}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${payload.from_name}`;
};
