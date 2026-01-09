
import React, { useState, useMemo } from 'react';
import { Trash2, ShoppingCart, Tag, Store, Search, X, ChevronUp, ChevronDown, ChevronRight, CheckSquare, FileSpreadsheet } from 'lucide-react';
import { QuoteItem } from '../types';
import { exportToExcel } from '../services/excelService';

interface QuoteTableProps {
  items: QuoteItem[];
  onRemoveItem: (id: string) => void;
  toggleSelection: (id: string) => void;
}

type SortKey = 'nome_produto' | 'nome_fornecedor' | 'preco_unitario';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey | null;
  direction: SortDirection;
}

const QuoteTable: React.FC<QuoteTableProps> = ({ items, onRemoveItem, toggleSelection }) => {
  const [brandFilter, setBrandFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

  const selectedItems = useMemo(() => items.filter(i => i.selected), [items]);

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const processedItems = useMemo(() => {
    let result = items.filter(item => 
      (item.marca || '').toLowerCase().includes(brandFilter.toLowerCase())
    );

    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key!] ?? '';
        const valB = b[sortConfig.key!] ?? '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [items, brandFilter, sortConfig]);

  const handleExportSelected = () => {
    if (selectedItems.length === 0) return;
    exportToExcel(selectedItems);
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShoppingCart className="text-slate-400" size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Nenhum item adicionado</h3>
        <p className="text-slate-500 max-w-xs mx-auto mt-2">
          Use a aba de extração para adicionar itens a partir de textos de cotação.
        </p>
      </div>
    );
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-blue-600" /> : <ChevronDown size={14} className="text-blue-600" />;
  };

  return (
    <div className="space-y-4">
      {/* Barra de Status e Ações Local da Tabela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Total Visível</span>
            <span className="font-bold text-slate-900">{processedItems.length} itens</span>
          </div>
          <div className="h-8 w-px bg-slate-100 hidden sm:block" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Selecionados</span>
            <span className="font-bold text-emerald-600">{selectedItems.length} para exportar</span>
          </div>
        </div>
        
        <button
          onClick={handleExportSelected}
          disabled={selectedItems.length === 0}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all border shadow-sm ${
            selectedItems.length > 0 
            ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 hover:shadow-emerald-900/10' 
            : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
          }`}
        >
          <FileSpreadsheet size={18} />
          Exportar Selecionados ({selectedItems.length})
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-10">
                  #
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('nome_produto')}
                >
                  <div className="flex items-center gap-1">
                    <span>Produto</span>
                    <SortIcon column="nome_produto" />
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <div className="flex flex-col gap-2">
                    <span>Marca</span>
                    <div className="relative group max-w-[140px]">
                      <input
                        type="text"
                        placeholder="Filtrar..."
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium normal-case"
                      />
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      {brandFilter && (
                        <button 
                          onClick={() => setBrandFilter('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('nome_fornecedor')}
                >
                  <div className="flex items-center gap-1">
                    <span>Fornecedor</span>
                    <SortIcon column="nome_fornecedor" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('preco_unitario')}
                >
                  <div className="flex items-center gap-1">
                    <span>Preço</span>
                    <SortIcon column="preco_unitario" />
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedItems.length > 0 ? (
                processedItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50 transition-colors group ${item.selected ? 'bg-emerald-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleSelection(item.id)}
                        className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${item.selected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white hover:border-blue-400'}`}
                      >
                        {item.selected && <CheckSquare size={14} />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${item.selected ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                          <Tag size={16} />
                        </div>
                        <span className="font-medium text-slate-900">{item.nome_produto || 'Sem nome'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {item.marca || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Store size={14} />
                        <span className="text-sm">{item.nome_fornecedor || 'Desconhecido'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">
                        {formatCurrency(item.preco_unitario)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Search size={24} className="text-slate-300" />
                      <p className="font-medium">Nenhum item encontrado com os filtros atuais</p>
                      <button 
                        onClick={() => setBrandFilter('')}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        Limpar filtros
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuoteTable;
