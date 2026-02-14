import React, { useState } from 'react';
import { QuoteItem } from '../types';
import { generateMailtoLink } from '../services/emailService';
import { Mail, Phone, AlertTriangle, Send, X } from 'lucide-react';

interface OrderSummaryProps {
  items: QuoteItem[];
  onClose: () => void;
}

const normalizeQuantity = (value?: number | null) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(Number(value)));
};

const normalizeUnitPrice = (value?: number | null) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

const lineTotal = (item: QuoteItem) => normalizeUnitPrice(item.preco_unitario) * normalizeQuantity(item.quantidade);

const OrderSummary: React.FC<OrderSummaryProps> = ({ items, onClose }) => {
  // Group items by supplier
  const orders = React.useMemo(() => {
    const grouped: Record<string, QuoteItem[]> = {};
    items.forEach(item => {
      const supplier = item.nome_fornecedor || 'Desconhecido';
      if (!grouped[supplier]) grouped[supplier] = [];
      grouped[supplier].push(item);
    });
    return grouped;
  }, [items]);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Resumo de Pedidos</h2>
            <p className="text-slate-500 text-sm">Envie os pedidos individualmente para cada fornecedor vencedor.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={24} className="text-slate-500" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {(Object.entries(orders) as [string, QuoteItem[]][]).map(([supplier, supplierItems]) => {
            const total = supplierItems.reduce((acc, i) => acc + lineTotal(i), 0);
            // Try to find email/phone from any item in the group
            const email = supplierItems.find(i => i.email_fornecedor)?.email_fornecedor;
            const phone = supplierItems.find(i => i.telefone_fornecedor)?.telefone_fornecedor;
            
            return (
              <div key={supplier} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{supplier}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                      {email ? (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <Mail size={14} /> <span>{email}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-500">
                          <AlertTriangle size={14} /> <span>Email não encontrado</span>
                        </div>
                      )}
                      {phone && (
                        <div className="flex items-center gap-1">
                          <Phone size={14} /> <span>{phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Total do Pedido</p>
                    <p className="text-xl font-bold text-slate-900">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-100">
                        <th className="pb-2 pl-2">Produto</th>
                        <th className="pb-2">Marca</th>
                        <th className="pb-2 text-right">Qtd</th>
                        <th className="pb-2 text-right">Preço Unit.</th>
                        <th className="pb-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierItems.map(item => (
                        <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                          <td className="py-2 pl-2 font-medium text-slate-700">{item.nome_produto}</td>
                          <td className="py-2 text-slate-500">{item.marca}</td>
                          <td className="py-2 text-right text-slate-600">{normalizeQuantity(item.quantidade)}</td>
                          <td className="py-2 text-right font-mono text-slate-600">
                            {normalizeUnitPrice(item.preco_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="py-2 text-right font-mono text-slate-700">{lineTotal(item).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <div className="mt-4 flex justify-end">
                    <a
                      href={generateMailtoLink(supplier, email, supplierItems)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                        ${email 
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20' 
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                      `}
                      onClick={(e) => !email && e.preventDefault()}
                    >
                      <Send size={18} />
                      Enviar Pedido por E-mail
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;
