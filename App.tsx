
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import QuoteExtractor from './components/QuoteExtractor';
import QuoteTable from './components/QuoteTable';
import ComparisonView from './components/ComparisonView';
import Chatbot from './components/Chatbot';
import { QuoteItem, AppView } from './types';
// Fixed missing ShoppingCart import
import { Package, DollarSign, FileSpreadsheet, Download, MessageSquare, ShoppingCart } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('auto_quotes_v2');
    if (saved) setItems(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('auto_quotes_v2', JSON.stringify(items));
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

  const selectWinners = () => {
    const grouped: Record<string, QuoteItem[]> = {};
    items.forEach(item => {
      const key = (item.nome_produto || '').toLowerCase().trim();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    const winnersIds = new Set<string>();
    Object.values(grouped).forEach(group => {
      const winner = group.reduce((min, curr) => 
        (curr.preco_unitario || Infinity) < (min.preco_unitario || Infinity) ? curr : min
      , group[0]);
      if (winner) winnersIds.add(winner.id);
    });

    setItems(prev => prev.map(item => ({
      ...item,
      selected: winnersIds.has(item.id)
    })));
  };

  const selectedItems = items.filter(i => i.selected);
  const totalValue = items.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);
  const cartValue = selectedItems.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      <Sidebar currentView={view} setView={setView} />
      
      <main className="flex-1 ml-64 p-12 overflow-y-auto scrollbar-thin">
        <header className="mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
              {view === AppView.DASHBOARD && 'Painel de Cotações'}
              {view === AppView.EXTRACTOR && 'Extração Inteligente'}
              {view === AppView.COMPARISON && 'Análise de Tiers'}
            </h1>
            <p className="text-slate-500 font-medium mt-2">Gestão profissional de suprimentos automotivos.</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                <ShoppingCart size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Carrinho</p>
                <p className="text-lg font-black text-slate-900 leading-tight">R$ {cartValue.toLocaleString('pt-BR')}</p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-2xl shadow-blue-900/30 flex items-center justify-center hover:bg-blue-700 hover:-translate-y-1 transition-all"
            >
              <MessageSquare size={28} />
            </button>
          </div>
        </header>

        {view === AppView.DASHBOARD && (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: 'Valor Total Cotado', value: `R$ ${totalValue.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-100' },
                { label: 'Itens no Carrinho', value: selectedItems.length.toString(), icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-100' },
                { label: 'Fornecedores', value: new Set(items.map(i => i.nome_fornecedor)).size.toString(), icon: FileSpreadsheet, color: 'text-purple-600', bg: 'bg-purple-100' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6 group hover:shadow-xl transition-all">
                  <div className={`${stat.bg} ${stat.color} p-5 rounded-2xl group-hover:scale-110 transition-transform`}><stat.icon size={32} /></div>
                  <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                    <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <QuoteTable items={items} onRemoveItem={removeItem} toggleSelection={toggleSelection} />
          </div>
        )}

        {view === AppView.EXTRACTOR && <QuoteExtractor onItemsExtracted={handleItemsExtracted} />}
        {view === AppView.COMPARISON && <ComparisonView items={items} toggleSelection={toggleSelection} selectAllWinners={selectWinners} />}
        
        {isChatOpen && <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} items={items} />}
      </main>
    </div>
  );
};

export default App;
