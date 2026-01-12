
import React, { useState, useMemo } from 'react';
import { Trash2, ShoppingCart, Tag, Store, Search, X, ChevronUp, ChevronDown, ChevronRight, CheckSquare, FileSpreadsheet, AlertCircle, CheckCircle2, History, Info } from 'lucide-react';
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
  const [showExportConfirm, setShowExportConfirm] = useState(false);

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

  const confirmAndExport = () => {
    // Enviamos todos os itens para gerar o mapa completo e os pedidos individuais
    exportToExcel(items);
    setShowExportConfirm(false);
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
      {/* Modal de Confirmação de Exportação */}
      {showExportConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowExportConfirm(false)}
          />
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner border-2 border-blue-100">
                <FileSpreadsheet size={48} />
              </div>
              
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-4 leading-none">Confirmar Exportação</h3>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                Você está prestes a gerar um relatório completo em Excel. O arquivo conterá o <span className="text-blue-600 font-bold">Mapa de Cotação</span> com todos os itens analisados e as ordens de compra individuais.
              </p>

              <div className="w-full bg-slate-50 rounded-3xl p-6 mb-10 border border-slate-100 text-left grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Itens</p>
                  <p className="text-2xl font-black text-slate-900">{items.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Ganhadores</p>
                  <p className="text-2xl font-black text-emerald-600">{selectedItems.length}</p>
                </div>
              </div>

              <div className="w-full flex flex-col sm:flex-row gap-4">
                <button
                  onClick={confirmAndExport}
                  className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-slate-900/30 hover:bg-slate-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                >
                  <CheckCircle2 size={18} /> Confirmar e Gerar
                </button>
                <button
                  onClick={() => setShowExportConfirm(false)}
                  className="flex-1 bg-slate-100 text-slate-600 py-5 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header da Tabela com Botão de Exportação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-8 py-5 rounded-[2rem] border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Info size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status do Mapa</p>
              <p className="text-sm font-bold text-slate-900">{items.length} itens cotados</p>
            </div>
          </div>
          <div className="h-10 w-px bg-slate-100 hidden md:block" />
          <div className="hidden md:block">
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Selecionados</p>
            <p className="text-sm font-bold text-emerald-600">{selectedItems.length} ganhadores</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowExportConfirm(true)}
          className="flex items-center justify-center gap-3 bg-blue-600 text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 hover:bg-blue-700 hover:-translate-y-1 transition-all"
        >
          <FileSpreadsheet size={18} />
          Exportar Relatório Completo
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12 text-center">Sel.</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => handleSort('nome_produto')}>
                  <div className="flex items-center gap-2">Produto <SortIcon column="nome_produto" /></div>
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="flex items-center gap-4">
                    <span>Marca</span>
                    <input
                      type="text"
                      placeholder="Filtrar..."
                      value={brandFilter}
                      onChange={(e) => setBrandFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-medium outline-none focus:ring-1 focus:ring-blue-500 transition-all w-24 normal-case"
                    />
                  </div>
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => handleSort('nome_fornecedor')}>
                  <div className="flex items-center gap-2">Fornecedor <SortIcon column="nome_fornecedor" /></div>
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => handleSort('preco_unitario')}>
                  <div className="flex items-center gap-2">Preço <SortIcon column="preco_unitario" /></div>
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Excluir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {processedItems.map((item) => (
                <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors group ${item.selected ? 'bg-emerald-50/20' : ''}`}>
                  <td className="px-8 py-5 text-center">
                    <button 
                      onClick={() => toggleSelection(item.id)}
                      className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center mx-auto ${item.selected ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'border-slate-200 bg-white hover:border-blue-400'}`}
                    >
                      {item.selected && <CheckSquare size={16} />}
                    </button>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.selected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Tag size={14} />
                      </div>
                      <span className="font-bold text-slate-800 text-sm tracking-tight">{item.nome_produto}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                      {item.marca || 'N/A'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                      <Store size={14} className="text-slate-300" />
                      <span className="text-sm">{item.nome_fornecedor || '---'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`text-sm font-black ${item.selected ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {formatCurrency(item.preco_unitario)}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuoteTable;
