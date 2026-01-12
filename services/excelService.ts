
import * as XLSX from 'xlsx';
import { QuoteItem } from '../types';

/**
 * Exporta o mapa completo de cotação e resumos financeiros em um único arquivo.
 */
export const exportToExcel = (allItems: QuoteItem[]) => {
  if (allItems.length === 0) return;

  const workbook = XLSX.utils.book_new();
  const selectedItems = allItems.filter(i => i.selected);
  const grandTotal = selectedItems.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);

  // --- 1. ABA: MAPA DE COTAÇÃO COMPLETO ---
  const mapData = allItems.map(item => ({
    'GANHADOR': item.selected ? 'SIM' : 'NÃO',
    'PRODUTO': item.nome_produto,
    'MARCA': item.marca || 'N/A',
    'FORNECEDOR': item.nome_fornecedor || 'Desconhecido',
    'PREÇO UNITÁRIO': item.preco_unitario,
    'DATA EXTRAÇÃO': new Date().toLocaleDateString('pt-BR')
  }));

  const mapSheet = XLSX.utils.json_to_sheet(mapData);
  mapSheet['!cols'] = [
    { wch: 12 }, { wch: 45 }, { wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(workbook, mapSheet, 'Mapa de Preços');

  // --- 2. ABA: RESUMO FINANCEIRO ---
  const suppliers = Array.from(new Set(selectedItems.map(i => i.nome_fornecedor || 'Desconhecido')));
  const summaryRows: (string | number)[][] = [
    ['RESUMO DE COMPRA'],
    ['Data da Geração:', new Date().toLocaleDateString('pt-BR')],
    [],
    ['FORNECEDOR', 'QTD ITENS', 'TOTAL FORNECEDOR'],
  ];

  suppliers.forEach(supplier => {
    const supplierItems = selectedItems.filter(i => (i.nome_fornecedor || 'Desconhecido') === supplier);
    const supplierTotal = supplierItems.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);
    summaryRows.push([supplier, supplierItems.length, supplierTotal]);
  });

  summaryRows.push([], ['TOTAL GERAL DO PEDIDO', '', grandTotal]);

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo Financeiro');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  XLSX.writeFile(workbook, `Mapa_Completo_AutoQuote_${timestamp}.xlsx`);
};

/**
 * Exporta um arquivo Excel separado para um fornecedor específico.
 */
export const exportSupplierOrder = (supplier: string, items: QuoteItem[]) => {
  if (items.length === 0) return;

  const workbook = XLSX.utils.book_new();
  const data = items.map(item => ({
    'DESCRIÇÃO DO PRODUTO': item.nome_produto,
    'MARCA': item.marca || 'Original/N/A',
    'PREÇO UNIT. (R$)': item.preco_unitario,
    'QUANTIDADE': 1,
    'TOTAL (R$)': item.preco_unitario
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const total = items.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);

  // Adiciona rodapé com total
  XLSX.utils.sheet_add_aoa(worksheet, [
    [],
    ['', '', '', 'TOTAL DO PEDIDO:', total]
  ], { origin: -1 });

  worksheet['!cols'] = [
    { wch: 50 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 15 }
  ];

  const timestamp = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const safeSupplierName = supplier.replace(/[\\/:*?"<>|]/g, '_').substring(0, 25);
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedido');
  XLSX.writeFile(workbook, `Pedido_${safeSupplierName}_${timestamp}.xlsx`);
};
