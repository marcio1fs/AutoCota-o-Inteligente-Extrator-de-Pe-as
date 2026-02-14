import React, { useEffect, useMemo, useState } from 'react';
import { X, Mail, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { QuoteItem } from '../types';
import { sendQuoteEmail, EmailData } from '../services/emailService';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: QuoteItem[];
  supplierName?: string;
  supplierEmail?: string;
}

const EmailModal: React.FC<EmailModalProps> = ({ 
  isOpen, 
  onClose, 
  items, 
  supplierName = 'Fornecedor',
  supplierEmail = ''
}) => {
  const [formData, setFormData] = useState({
    to_email: supplierEmail,
    to_name: supplierName,
    from_name: '',
    subject: `Cotação de Peças - ${supplierName}`,
    message: 'Prezado(a),\n\nSegue em anexo a cotação solicitada para análise.\n\nAguardo retorno.\n\nAtenciosamente,'
  });

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [itemQuantities, setItemQuantities] = useState<number[]>(() => items.map((item) => Math.max(1, Math.floor(item.quantidade || 1))));

  useEffect(() => {
    if (isOpen) {
      setItemQuantities(items.map((item) => Math.max(1, Math.floor(item.quantidade || 1))));
    }
  }, [isOpen, items]);

  const normalizeQuantity = (value: number) => {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.floor(value));
  };

  const getItemsWithQuantities = () => {
    return items.map((item, index) => ({
      ...item,
      quantidade: normalizeQuantity(itemQuantities[index] ?? 1)
    }));
  };

  const handleQuantityChange = (index: number, rawValue: string) => {
    const parsed = Number(rawValue);
    setItemQuantities((previous) => {
      const next = [...previous];
      next[index] = Number.isNaN(parsed) ? 1 : normalizeQuantity(parsed);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const emailData: EmailData = {
      ...formData,
      items: getItemsWithQuantities()
    };

    const response = await sendQuoteEmail(emailData);
    setResult(response);
    setSending(false);

    if (response.success) {
      setTimeout(() => {
        onClose();
        setResult(null);
      }, 2000);
    }
  };

  if (!isOpen) return null;

  const itemComputedTotals = useMemo(
    () => items.map((item, index) => {
      const quantity = normalizeQuantity(itemQuantities[index] ?? 1);
      const lineTotal = (item.preco_unitario || 0) * quantity;
      return { quantity, lineTotal };
    }),
    [items, itemQuantities]
  );

  const total = useMemo(
    () => itemComputedTotals.reduce((sum, row) => sum + row.lineTotal, 0),
    [itemComputedTotals]
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Enviar Cotação por Email</h2>
              <p className="text-sm text-gray-500">{items.length} item(ns) - Total: R$ {total.toFixed(2)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Formulário */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email do Destinatário *
              </label>
              <input
                type="email"
                required
                value={formData.to_email}
                onChange={(e) => setFormData({ ...formData, to_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="fornecedor@empresa.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                📧 Com backend SMTP ativo, o email é enviado diretamente para este destinatário
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Destinatário *
              </label>
              <input
                type="text"
                required
                value={formData.to_name}
                onChange={(e) => setFormData({ ...formData, to_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nome da empresa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seu Nome *
              </label>
              <input
                type="text"
                required
                value={formData.from_name}
                onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Seu nome"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assunto *
              </label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mensagem *
              </label>
              <textarea
                required
                rows={6}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Preview dos itens */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Itens incluídos:</h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {items.map((item, index) => (
                <div key={index} className="text-sm text-gray-600 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{item.nome_produto} ({item.marca || 'N/A'})</p>
                    <p className="text-xs text-gray-500">R$ {item.preco_unitario?.toFixed(2) || '0.00'} / unidade</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Qtd.</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={itemComputedTotals[index]?.quantity ?? 1}
                      onChange={(e) => handleQuantityChange(index, e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded-md text-right"
                    />
                  </div>
                  <span className="font-medium w-24 text-right">
                    R$ {(itemComputedTotals[index]?.lineTotal ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm font-semibold">
              <span>Total:</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Resultado */}
          {result && (
            <div className={`rounded-lg p-4 flex items-start gap-2 ${
              result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {result.success ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm whitespace-pre-line flex-1">{result.message}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Email
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmailModal;
