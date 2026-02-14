
export interface QuoteItem {
  id: string;
  item_id?: string | null;
  item_base?: string | null;
  nome_produto: string | null;
  codigo_referencia?: string | null;
  marca: string | null;
  marca_desejada?: string | null;
  nome_fornecedor: string | null;
  email_fornecedor?: string | null;
  telefone_fornecedor?: string | null;
  preco_unitario: number | null;
  quantidade?: number | null;
  selected?: boolean;
}

export interface BestOffer {
  best: QuoteItem;
  count: number;
  savings: number;
  all: QuoteItem[];
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  EXTRACTOR = 'EXTRACTOR',
  COMPARISON = 'COMPARISON',
  HISTORY = 'HISTORY'
}
