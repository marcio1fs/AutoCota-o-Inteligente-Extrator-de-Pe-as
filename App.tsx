
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import QuoteExtractor from './components/QuoteExtractor';
import QuoteTable from './components/QuoteTable';
import ComparisonView from './components/ComparisonView';
import { QuoteItem, AppView } from './types';
import { Package, DollarSign, FileSpreadsheet, Download, CheckSquare, Square, Trophy } from 'lucide-react';
import { exportToExcel } from './services/excelService';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [items, setItems] = useState<QuoteItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('auto_quotes');
    if (saved) {
      try { setItems(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('auto_quotes', JSON.stringify(items));
  }, [items]);

  const handleItemsExtracted = (newItems: QuoteItem[]) => {
    setItems(prev => [...prev, ...newItems]);
    setView(AppView.DASHBOARD);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleSelection = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const selectAll = () => {
    setItems(prev => prev.map(item => ({ ...item, selected: true })));
  };

  const deselectAll = () => {
    setItems(prev => prev.map(item => ({ ...item, selected: false })));
  };

  const selectWinners = () => {
    setItems(prev => {
      // Agrupar itens por nome de produto (normalizado)
      const grouped: Record<string, QuoteItem[]> = {};
      prev.forEach(item => {
        const key = (item.nome_produto || '').toLowerCase().trim();
        if (key) {
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(item);
        }
      });

      // Identificar o ID do vencedor (menor preço) em cada grupo
      const winnersIds = new Set<string>();
      Object.values(grouped).forEach(group => {
        const winner = group.reduce((min, curr) => 
          (curr.preco_unitario || Infinity) < (min.preco_unitario || Infinity) ? curr : min
        , group[0]);
        if (winner && winner.preco_unitario !== null) {
          winnersIds.add(winner.id);
        }
      });

      // Atualizar seleção: apenas os vencedores ficam selecionados
      return prev.map(item => ({
        ...item,
        selected: winnersIds.has(item.id)
      }));
    });
  };

  const selectedItems = items.filter(i => i.selected);
  const totalSpent = items.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);
  const selectedTotal = selectedItems.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);
  const uniqueItemsCount = new Set(items.map(i => (i.nome_produto || '').toLowerCase())).size;

  const handleExport = () => {
    if (selectedItems.length === 0) {
      alert("Por favor, selecione ao menos um item para exportar.");
      return;
    }
    exportToExcel(selectedItems);
  };

  const renderView = () => {
    switch (view) {
      case AppView.EXTRACTOR:
        return <QuoteExtractor onItemsExtracted={handleItemsExtracted} />;
      case AppView.COMPARISON:
        return <ComparisonView items={items} toggleSelection={toggleSelection} selectAllWinners={selectWinners} />;
      default:
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Cotado', value: `R$ ${totalSpent.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-100' },
                { label: 'No Carrinho', value: `R$ ${selectedTotal.toLocaleString('pt-BR')}`, icon: Download, color: 'text-emerald-600', bg: 'bg-emerald-100' },
                { label: 'Itens Distintos', value: uniqueItemsCount.toString(), icon: Package, color: 'text-orange-600', bg: 'bg-orange-100' },
                { label: 'Selecionados', value: selectedItems.length.toString(), icon: FileSpreadsheet, color: 'text-purple-600', bg: 'bg-purple-100' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}><stat.icon size={24} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                    <p className="text-xl font-black text-slate-900">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-900">Histórico de Cotações</h2>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={selectWinners}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-700 hover:bg-blue-100 transition-all shadow-sm"
                  >
                    <Trophy size={16} /> Selecionar Melhores Preços
                  </button>
                  <button 
                    onClick={selectAll}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <CheckSquare size={16} /> Selecionar Tudo
                  </button>
                  <button 
                    onClick={deselectAll}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <Square size={16} /> Limpar
                  </button>
                  <button 
                    onClick={handleExport}
                    disabled={selectedItems.length === 0}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all shadow-lg ${
                      selectedItems.length > 0 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-900/20' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <FileSpreadsheet size={18} /> Exportar Pedido ({selectedItems.length})
                  </button>
                  <button 
                    onClick={() => setView(AppView.EXTRACTOR)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
                  >
                    + Adicionar Itens
                  </button>
                </div>
              </div>
              <QuoteTable items={items} onRemoveItem={removeItem} toggleSelection={toggleSelection} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar currentView={view} setView={setView} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto scrollbar-thin">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {view === AppView.DASHBOARD && 'Painel Geral'}
              {view === AppView.EXTRACTOR && 'Extração Inteligente'}
              {view === AppView.COMPARISON && 'Comparador de Ofertas'}
            </h1>
            <p className="text-slate-500 mt-1">Crie seus pedidos profissionais com um clique.</p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
              <FileSpreadsheet size={18} />
            </div>
            <div className="pr-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Status do Pedido</p>
              <p className="text-sm font-bold text-slate-700">{selectedItems.length} itens prontos</p>
            </div>
          </div>
        </header>
        {renderView()}
      </main>
    </div>
  );
};

export default App;
