import { getAuthHeaders } from './authService';

const BACKEND_API_URL = (import.meta as any).env?.VITE_BACKEND_API_URL || '/api';

export interface OrderHistorySummary {
  id: number;
  created_at: string;
  to_email: string;
  to_name: string;
  from_name: string;
  subject: string;
  item_count: number;
  total_amount: number;
}

export interface OrderHistoryItem {
  nome_produto: string;
  codigo_referencia: string;
  marca: string;
  nome_fornecedor: string;
  preco_unitario: number;
  quantidade: number;
  total_item: number;
}

export interface OrderHistoryDetail extends OrderHistorySummary {
  message: string;
  items: OrderHistoryItem[];
}

export const fetchOrders = async (limit = 50): Promise<OrderHistorySummary[]> => {
  const response = await fetch(`${BACKEND_API_URL}/orders?limit=${limit}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  if (response.status === 401) throw new Error('Sessão expirada. Faça login novamente.');
  if (!response.ok) throw new Error('Falha ao carregar histórico de pedidos.');

  const data = await response.json();
  return Array.isArray(data?.orders) ? data.orders : [];
};

export const fetchOrderDetail = async (orderId: number): Promise<OrderHistoryDetail> => {
  const response = await fetch(`${BACKEND_API_URL}/orders/${orderId}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  if (response.status === 401) throw new Error('Sessão expirada. Faça login novamente.');
  if (!response.ok) throw new Error('Falha ao carregar detalhes do pedido.');

  const data = await response.json();
  return data.order;
};
