
import * as XLSX from 'xlsx';
import { QuoteItem } from '../types';

export const exportToExcel = (items: QuoteItem[]) => {
  if (items.length === 0) return;

  const workbook = XLSX.utils.book_new();
  const grandTotal = items.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);

  // 1. Criar Planilha de Resumo Geral
  const summaryRows = [
    ['RESUMO DO PEDIDO CONSOLIDADO'],
    ['Data da Exportação:', new Date().toLocaleDateString('pt-BR')],
    ['Total de Itens Selecionados:', items.length],
    [],
    ['FORNECEDOR', 'VALOR TOTAL DO PEDIDO'],
  ];

  const suppliers = Array.from(new Set(items.map(i => i.nome_fornecedor || 'Desconhecido')));
  
  suppliers.forEach(supplier => {
    const supplierTotal = items
      .filter(i => (i.nome_fornecedor || 'Desconhecido') === supplier)
      .reduce((acc, i) => acc + (i.preco_unitario || 0), 0);
    summaryRows.push([supplier, supplierTotal]);
  });

  summaryRows.push([], ['TOTAL GERAL DO PEDIDO', grandTotal]);

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  
  // Configurar larguras das colunas
  summarySheet['!cols'] = [{ wch: 40 }, { wch: 25 }];
  
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo Geral');

  // 2. Criar Planilhas Individuais por Fornecedor
  suppliers.forEach(supplier => {
    const supplierItems = items.filter(i => (i.nome_fornecedor || 'Desconhecido') === supplier);
    
    const data = supplierItems.map(item => ({
      'Produto': item.nome_produto,
      'Marca': item.marca,
      'Preço Unitário': item.preco_unitario,
      'Quantidade': 1,
      'Total': item.preco_unitario
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    
    const total = supplierItems.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);
    XLSX.utils.sheet_add_aoa(worksheet, [
      [],
      ['', '', '', 'TOTAL DO FORNECEDOR', total]
    ], { origin: -1 });

    // Ajustar larguras das colunas
    worksheet['!cols'] = [
      { wch: 45 }, // Produto
      { wch: 20 }, // Marca
      { wch: 15 }, // Preço Unitário
      { wch: 12 }, // Quantidade
      { wch: 15 }  // Total
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, supplier.substring(0, 30));
  });

  // Salvar arquivo com data
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `AutoQuote_Pedido_Selecionado_${dateStr}.xlsx`);
};
