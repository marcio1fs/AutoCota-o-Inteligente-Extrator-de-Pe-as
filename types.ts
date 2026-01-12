
export interface QuoteItem {
  id: string;
  nome_produto: string | null;
  marca: string | null;
  nome_fornecedor: string | null;
  preco_unitario: number | null;
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
  COMPARISON = 'COMPARISON'
}
