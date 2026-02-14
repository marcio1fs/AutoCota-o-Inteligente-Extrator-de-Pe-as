
import { QuoteItem } from '../types';

let xlsxPromise: Promise<typeof import('xlsx')> | null = null;

const loadXLSX = async () => {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx');
  }
  return xlsxPromise;
};

const normalizeQuantity = (value?: number | null) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(Number(value)));
};

const normalizeUnitPrice = (value?: number | null) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

const toMoney = (value: number) => Math.round(value * 100) / 100;

const calculateLineTotal = (item: QuoteItem) => {
  const quantity = normalizeQuantity(item.quantidade);
  const unitPrice = normalizeUnitPrice(item.preco_unitario);
  return toMoney(unitPrice * quantity);
};

const calculateItemsTotal = (items: QuoteItem[]) => {
  return toMoney(items.reduce((acc, item) => acc + calculateLineTotal(item), 0));
};

/**
 * Exporta o mapa completo de cotação e resumos financeiros em um único arquivo.
 */
export const exportToExcel = async (allItems: QuoteItem[]) => {
  if (allItems.length === 0) return;

  const XLSX = await loadXLSX();

  const workbook = XLSX.utils.book_new();
  const selectedItems = allItems.filter(i => i.selected);
  const grandTotal = calculateItemsTotal(selectedItems);

  // --- 1. ABA: MAPA DE COTAÇÃO COMPLETO ---
  const mapData = allItems.map(item => ({
    'DESCRIÇÃO DO PRODUTO': item.nome_produto,
    'CÓDIGO/REF': item.codigo_referencia || 'N/A',
    'MARCA': item.marca || 'N/A',
    'FORNECEDOR': item.nome_fornecedor || 'Desconhecido',
    'EMAIL': item.email_fornecedor || '',
    'TELEFONE': item.telefone_fornecedor || '',
    'PREÇO UNITÁRIO': normalizeUnitPrice(item.preco_unitario),
    'QUANTIDADE': normalizeQuantity(item.quantidade),
    'TOTAL ITEM': calculateLineTotal(item),
    'SELECIONADO': item.selected ? 'SIM' : 'NÃO',
    'DATA EXTRAÇÃO': new Date().toLocaleDateString('pt-BR')
  }));

  const mapSheet = XLSX.utils.json_to_sheet(mapData);
  mapSheet['!cols'] = [
    { wch: 40 }, { wch: 18 }, { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 15 }, { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(workbook, mapSheet, 'Mapa de Preços');

  // --- 2. ABA: RESUMO FINANCEIRO ---
  const suppliers = Array.from(new Set(selectedItems.map(i => i.nome_fornecedor || 'Desconhecido')));
  const summaryRows: (string | number)[][] = [
    ['RESUMO DE COMPRA'],
    ['Data da Geração:', new Date().toLocaleDateString('pt-BR')],
    [],
    ['FORNECEDOR', 'QTD ITENS', 'QTD PEÇAS', 'TOTAL FORNECEDOR'],
  ];

  suppliers.forEach(supplier => {
    const supplierItems = selectedItems.filter(i => (i.nome_fornecedor || 'Desconhecido') === supplier);
    const supplierPieces = supplierItems.reduce((acc, item) => acc + normalizeQuantity(item.quantidade), 0);
    const supplierTotal = calculateItemsTotal(supplierItems);
    summaryRows.push([supplier, supplierItems.length, supplierPieces, supplierTotal]);
  });

  const totalPieces = selectedItems.reduce((acc, item) => acc + normalizeQuantity(item.quantidade), 0);
  summaryRows.push([], ['TOTAL GERAL DO PEDIDO', selectedItems.length, totalPieces, grandTotal]);

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo Financeiro');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  XLSX.writeFile(workbook, `Mapa_Completo_AutoQuote_${timestamp}.xlsx`);
};

/**
 * Exporta um arquivo Excel separado para um fornecedor específico.
 * SEMPRE exporta TODOS os itens do fornecedor, selecionados ou não.
 */
export const exportSupplierOrder = async (supplier: string, items: QuoteItem[]) => {
  if (items.length === 0) {
    alert(`⚠️ Nenhum item encontrado para ${supplier}`);
    return;
  }

  const XLSX = await loadXLSX();

  const workbook = XLSX.utils.book_new();
  const data = items.map(item => {
    const quantity = normalizeQuantity(item.quantidade);
    const unitPrice = normalizeUnitPrice(item.preco_unitario);

    return {
      'DESCRIÇÃO DO PRODUTO': item.nome_produto,
      'MARCA': item.marca || 'Original/N/A',
      'PREÇO UNIT. (R$)': unitPrice,
      'QUANTIDADE': quantity,
      'TOTAL (R$)': toMoney(unitPrice * quantity),
      'SIMILARES': '' // Campo vazio para preenchimento manual
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const total = calculateItemsTotal(items);

  // Adiciona rodapé com total
  XLSX.utils.sheet_add_aoa(worksheet, [
    [],
    ['', '', '', '', `TOTAL DO PEDIDO:`, total]
  ], { origin: -1 });

  worksheet['!cols'] = [
    { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 30 }
  ];

  const timestamp = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const safeSupplierName = supplier.replace(/[\\/:*?"<>|]/g, '_').substring(0, 25);
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedido');
  XLSX.writeFile(workbook, `Pedido_${safeSupplierName}_${timestamp}.xlsx`);
};
