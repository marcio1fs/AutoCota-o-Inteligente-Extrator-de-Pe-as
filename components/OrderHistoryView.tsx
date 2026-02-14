import React, { useEffect, useRef, useState } from 'react';
import { Clock3, FileText, Loader2 } from 'lucide-react';
import {
  fetchOrderDetail,
  fetchOrders,
  OrderHistoryDetail,
  OrderHistorySummary,
} from '../services/orderHistoryService';
import { recordScreenMetric } from '../services/performanceMonitor';

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const formatCurrency = (value: number) => {
  return BRL_FORMATTER.format(value || 0);
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('pt-BR');
};

const csvEscape = (value: string | number) => {
  const raw = String(value ?? '');
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
};

const OrderHistoryView: React.FC = () => {
  const [orders, setOrders] = useState<OrderHistorySummary[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodDays, setPeriodDays] = useState<'all' | '7' | '30' | '90'>('all');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const loadOrders = async () => {
    const startedAt = performance.now();
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrders(100);
      setOrders(data);
      recordScreenMetric('history', 'load_orders', performance.now() - startedAt, {
        warnThresholdMs: 180,
        details: { orders: data.length },
      });
    } catch (err: any) {
      recordScreenMetric('history', 'load_orders_error', performance.now() - startedAt, {
        warnThresholdMs: 120,
      });
      setError(err?.message || 'Erro ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrder = async (orderId: number) => {
    const startedAt = performance.now();
    setLoadingDetail(true);
    try {
      const detail = await fetchOrderDetail(orderId);
      setSelectedOrder(detail);
      recordScreenMetric('history', 'select_order', performance.now() - startedAt, {
        warnThresholdMs: 150,
        details: { orderId, items: detail.items.length },
      });
    } catch (err: any) {
      recordScreenMetric('history', 'select_order_error', performance.now() - startedAt, {
        warnThresholdMs: 120,
        details: { orderId },
      });
      setError(err?.message || 'Erro ao carregar detalhes do pedido.');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!exportMenuOpen) return;

      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportMenuOpen]);

  const filteredOrders = orders.filter((order) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesTerm =
      !term ||
      order.to_name.toLowerCase().includes(term) ||
      order.to_email.toLowerCase().includes(term) ||
      order.subject.toLowerCase().includes(term);

    if (!matchesTerm) return false;

    if (periodDays === 'all') return true;

    const createdAt = new Date(order.created_at);
    if (Number.isNaN(createdAt.getTime())) return false;

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - Number(periodDays));
    return createdAt >= cutoff;
  });

  const exportFilteredOrdersCsv = () => {
    if (filteredOrders.length === 0) return;

    const header = [
      'Pedido ID',
      'Data/Hora',
      'Destinatário',
      'Email Destinatário',
      'Remetente',
      'Assunto',
      'Qtd Itens',
      'Total'
    ];

    const rows = filteredOrders.map((order) => [
      order.id,
      formatDateTime(order.created_at),
      order.to_name,
      order.to_email,
      order.from_name,
      order.subject,
      order.item_count,
      order.total_amount.toFixed(2)
    ]);

    const csvContent = [header, ...rows]
      .map((line) => line.map((cell) => csvEscape(cell)).join(';'))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    link.href = url;
    link.download = `historico_pedidos_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const exportSelectedOrderItemsCsv = () => {
    if (!selectedOrder) return;

    const header = [
      'Pedido ID',
      'Data/Hora',
      'Destinatário',
      'Email Destinatário',
      'Produto',
      'Referência',
      'Marca',
      'Fornecedor',
      'Quantidade',
      'Preço Unitário',
      'Total Item'
    ];

    const rows = selectedOrder.items.map((item) => [
      selectedOrder.id,
      formatDateTime(selectedOrder.created_at),
      selectedOrder.to_name,
      selectedOrder.to_email,
      item.nome_produto,
      item.codigo_referencia,
      item.marca,
      item.nome_fornecedor,
      item.quantidade,
      item.preco_unitario.toFixed(2),
      item.total_item.toFixed(2)
    ]);

    const csvContent = [header, ...rows]
      .map((line) => line.map((cell) => csvEscape(cell)).join(';'))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    link.href = url;
    link.download = `pedido_${selectedOrder.id}_itens_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-[2rem] border border-slate-200 p-12 flex items-center justify-center gap-3 text-slate-500">
        <Loader2 className="animate-spin" size={20} /> Carregando histórico de pedidos...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className="bg-white rounded-[2rem] border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Pedidos Enviados</h3>
          <div className="flex items-center gap-3">
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen((prev) => !prev)}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                Exportar
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-1">
                  <button
                    onClick={exportFilteredOrdersCsv}
                    disabled={filteredOrders.length === 0}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    Resumo (filtrado) CSV
                  </button>
                  <button
                    onClick={exportSelectedOrderItemsCsv}
                    disabled={!selectedOrder}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    Itens do pedido selecionado CSV
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={loadOrders}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Atualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar fornecedor, email ou assunto"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(e.target.value as 'all' | '7' | '30' | '90')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Período: Todos</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {filteredOrders.length === 0 ? (
          <div className="text-slate-500 text-sm py-6">Nenhum pedido encontrado no banco.</div>
        ) : (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {filteredOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => handleSelectOrder(order.id)}
                className={`w-full text-left border rounded-xl p-4 transition-all ${selectedOrder?.id === order.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <p className="text-sm font-black text-slate-900">Pedido #{order.id}</p>
                <p className="text-xs text-slate-500 mt-1 truncate">{order.subject}</p>
                <p className="text-xs text-slate-500 truncate">Para: {order.to_name} ({order.to_email})</p>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-slate-500 flex items-center gap-1"><Clock3 size={12} /> {formatDateTime(order.created_at)}</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(order.total_amount)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Detalhes do Pedido</h3>
        </div>

        {loadingDetail ? (
          <div className="py-10 text-slate-500 flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Carregando detalhes...</div>
        ) : !selectedOrder ? (
          <div className="py-10 text-slate-500 text-sm flex items-center gap-2">
            <FileText size={16} /> Selecione um pedido para ver os itens.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-slate-600 space-y-1">
              <p><strong>Pedido:</strong> #{selectedOrder.id}</p>
              <p><strong>Destinatário:</strong> {selectedOrder.to_name} ({selectedOrder.to_email})</p>
              <p><strong>Criado em:</strong> {formatDateTime(selectedOrder.created_at)}</p>
              <p><strong>Total:</strong> {formatCurrency(selectedOrder.total_amount)}</p>
            </div>

            <div className="border rounded-xl border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Produto</th>
                    <th className="text-right px-3 py-2">Qtd</th>
                    <th className="text-right px-3 py-2">Unitário</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item, index) => (
                    <tr key={`${item.nome_produto}-${index}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-800">{item.nome_produto}</p>
                        <p className="text-slate-500">{item.marca} • Ref: {item.codigo_referencia}</p>
                      </td>
                      <td className="px-3 py-2 text-right">{item.quantidade}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.preco_unitario)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(item.total_item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistoryView;
