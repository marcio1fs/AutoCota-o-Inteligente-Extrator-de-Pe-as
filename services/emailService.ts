import { QuoteItem } from '../types';

export const generateMailtoLink = (
  supplierName: string,
  supplierEmail: string | null | undefined,
  items: QuoteItem[]
): string => {
  const email = supplierEmail || '';
  const subject = encodeURIComponent(`Pedido de Peças - ${supplierName}`);
  
  const total = items.reduce((sum, item) => sum + (item.preco_unitario || 0), 0);
  
  let body = `Olá, gostaria de fechar o pedido para os seguintes itens:\n\n`;
  
  items.forEach(item => {
    body += `- ${item.nome_produto} (${item.marca || 'N/A'}): R$ ${item.preco_unitario?.toFixed(2)}\n`;
  });
  
  body += `\nTotal Estimado: R$ ${total.toFixed(2)}\n\n`;
  body += `Por favor, confirmem a disponibilidade e o prazo de entrega.\n`;
  body += `Anexo, envio a planilha de cotação.\n\n`;
  body += `Atenciosamente,`;

  return `mailto:${email}?subject=${subject}&body=${encodeURIComponent(body)}`;
};
