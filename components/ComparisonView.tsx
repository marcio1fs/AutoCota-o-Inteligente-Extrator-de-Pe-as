
import React from 'react';
import { Trophy, TrendingDown, ArrowRight, ShieldCheck, ShoppingCart, Store, CheckCircle2, CheckSquare } from 'lucide-react';
import { QuoteItem, BestOffer } from '../types';

interface ComparisonViewProps {
  items: QuoteItem[];
  toggleSelection: (id: string) => void;
  selectAllWinners: () => void;
}

const PREMIUM_BRANDS = [
  'bosch', 'trw', 'ate', 'metal leve', 'mahle', 'ina', 'fag', 'luk', 
  'cofap', 'monroe', 'nakata', 'magneti marelli', 'fremax', 'mann'
];

const ComparisonView: React.FC<ComparisonViewProps> = ({ items, toggleSelection, selectAllWinners }) => {
  const validItems = items.filter(i => i.nome_produto && i.preco_unitario !== null);
  
  const grouped = validItems.reduce((acc, item) => {
    const key = (item.nome_produto || 'desconhecido').toLowerCase().trim();
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, QuoteItem[]>);

  const bestOffers: BestOffer[] = Object.values(grouped).map(group => {
    const sorted = [...group].sort((a, b) => (a.preco_unitario || 0) - (b.preco_unitario || 0));
    const best = sorted[0];
    const average = group.length > 1 
      ? group.reduce((sum, i) => sum + (i.preco_unitario || 0), 0) / group.length 
      : (best.preco_unitario || 0);
    const savings = group.length > 1 ? average - (best.preco_unitario || 0) : 0;
    
    return {
      best,
      count: group.length,
      savings,
      all: sorted
    };
  }).sort((a, b) => b.savings - a.savings);

  if (validItems.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <ShoppingCart className="mx-auto text-slate-300 mb-4" size={48} />
        <h3 className="text-lg font-bold text-slate-800">Sem dados para comparação</h3>
        <p className="text-slate-500 mt-2">Extraia cotações para ver os melhores preços aqui.</p>
      </div>
    );
  }

  const isPremium = (marca: string | null) => {
    if (!marca) return false;
    return PREMIUM_BRANDS.some(pb => marca.toLowerCase().includes(pb));
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Análise de Fornecedores</h2>
          <p className="text-slate-500">Selecione as melhores ofertas para gerar seu pedido Excel.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={selectAllWinners}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all"
          >
            <Trophy size={20} /> Selecionar Todos os Vencedores
          </button>
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-lg shadow-emerald-900/20">
            <div className="bg-white/20 p-2 rounded-lg">
              <ShoppingCart size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase opacity-80 leading-none">Carrinho</p>
              <p className="text-lg font-black">{items.filter(i => i.selected).length} itens</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {bestOffers.map((offer, idx) => (
          <div key={idx} className="group flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
                Item {idx + 1}
              </span>
              <h3 className="text-xl font-bold text-slate-800 uppercase truncate">{offer.best.nome_produto}</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className={`lg:col-span-7 bg-white rounded-3xl border-2 transition-all overflow-hidden relative ${offer.best.selected ? 'border-emerald-500 shadow-emerald-500/10' : 'border-blue-500 shadow-blue-500/10'}`}>
                <div className={`absolute top-0 right-0 text-white px-4 py-1 rounded-bl-2xl font-black text-[10px] uppercase tracking-tighter flex items-center gap-1 ${offer.best.selected ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                  {offer.best.selected ? <CheckCircle2 size={10} /> : <Trophy size={10} />} 
                  {offer.best.selected ? 'Selecionado' : 'Melhor Preço'}
                </div>
                
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${offer.best.selected ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                        <Store size={28} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Vencedor</p>
                        <h4 className="text-xl font-black text-slate-900">{offer.best.nome_fornecedor}</h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-bold uppercase">Preço Unitário</p>
                      <p className={`text-3xl font-black transition-colors ${offer.best.selected ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {formatCurrency(offer.best.preco_unitario)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">Marca: {offer.best.marca}</span>
                      {isPremium(offer.best.marca) && (
                        <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          <ShieldCheck size={10} /> Premium
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => toggleSelection(offer.best.id)}
                      className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        offer.best.selected 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {offer.best.selected ? 'DESELECIONAR' : 'SELECIONAR'} <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col gap-3">
                <div className="flex items-center justify-between px-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outras Ofertas ({offer.count - 1})</p>
                </div>

                {offer.count > 1 ? (
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[180px] pr-2 scrollbar-thin">
                    {offer.all.slice(1).map((other, oIdx) => (
                      <div key={oIdx} className={`bg-white p-4 rounded-2xl border transition-all flex items-center justify-between hover:bg-slate-50 ${other.selected ? 'border-emerald-500' : 'border-slate-200'}`}>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => toggleSelection(other.id)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${other.selected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}
                          >
                            {other.selected && <CheckCircle2 size={12} />}
                          </button>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{other.nome_fornecedor}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] text-slate-500 uppercase">{other.marca}</p>
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-black text-slate-400">{formatCurrency(other.preco_unitario)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-6 text-center">
                    <p className="text-xs text-slate-400 font-medium">Sem concorrência para este item.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComparisonView;
