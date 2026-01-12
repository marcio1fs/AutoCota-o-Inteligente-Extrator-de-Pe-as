
import React, { useMemo } from 'react';
import { Trophy, ShieldCheck, ShoppingCart, Store, CheckCircle2, Lightbulb, Scale, Zap, Layers, Activity, Wrench, Thermometer, Sun, Package, ArrowDownRight, TrendingUp, ChevronRight, FileSpreadsheet, Mail, Download, Percent, AlertTriangle } from 'lucide-react';
import { QuoteItem } from '../types';
import { exportToExcel, exportSupplierOrder } from '../services/excelService';

interface ComparisonViewProps {
  items: QuoteItem[];
  toggleSelection: (id: string) => void;
  selectAllWinners: () => void;
}

const AUTOMOTIVE_FAMILIES = {
  'Sistema de Freios': ['bosch', 'trw', 'ate', 'fremax', 'brembo', 'jurid', 'varga', 'cobreq', 'willtec', 'fras-le', 'plasbestos'],
  'Suspensão & Direção': ['cofap', 'monroe', 'kayaba', 'kyb', 'nakata', 'lemforder', 'viemar', 'trw', 'perfect', 'sampel', 'axios'],
  'Transmissão & Embreagem': ['luk', 'sachs', 'valeo', 'fag', 'ina', 'skf', 'timken', 'nsk', 'spicer'],
  'Motor & Filtragem': ['mahle', 'metal leve', 'mann', 'hengst', 'fram', 'bosch', 'ks', 'tecfil', 'weca', 'mte-thomson', 'dayco', 'gates', 'contitech'],
  'Elétrica & Ignição': ['magneti marelli', 'bosch', 'ngk', 'denso', 'delphi', 'mtf', 'gauss', 'euro', 'ikro', 'marflex'],
  'Arrefecimento': ['valeo', 'visconde', 'behr', 'mahle', 'magneti marelli', 'gate', 'mte'],
  'Iluminação': ['hella', 'arteb', 'orgus', 'vic', 'valeo', 'magneti marelli', 'nino']
};

const PREMIUM_BRANDS = [
  'bosch', 'trw', 'ate', 'metal leve', 'mahle', 'ina', 'fag', 'luk', 
  'cofap', 'monroe', 'nakata', 'magneti marelli', 'fremax', 'mann', 'hengst', 'lemforder', 'sachs', 'valeo', 'skf', 'ngk',
  'denso', 'delphi', 'brembo', 'gates', 'contitech', 'dayco', 'behr', 'hella'
];

const ComparisonView: React.FC<ComparisonViewProps> = ({ items, toggleSelection, selectAllWinners }) => {
  
  const normalizeProductName = (name: string | null): string => {
    if (!name) return 'desconhecido';
    return name
      .toLowerCase()
      .replace(/dianteir[oa]|traseir[oa]|diant|tras|unidade|par|kit|jogo|lado|esquerdo|direito|esq|dir/g, '')
      .replace(/[a-z0-9]*[0-9]{3,}[a-z0-9]*/g, '') // Remove códigos
      .replace(/\s+/g, ' ')
      .trim();
  };

  const isPremium = (marca: string | null) => {
    if (!marca) return false;
    const lowerMarca = marca.toLowerCase();
    return PREMIUM_BRANDS.some(pb => lowerMarca.includes(pb));
  };

  const getFamilyIcon = (family: string) => {
    switch (family) {
      case 'Sistema de Freios': return <Scale size={16} className="text-red-500" />;
      case 'Suspensão & Direção': return <Activity size={16} className="text-emerald-500" />;
      case 'Transmissão & Embreagem': return <Wrench size={16} className="text-orange-500" />;
      case 'Motor & Filtragem': return <Layers size={16} className="text-blue-500" />;
      case 'Arrefecimento': return <Thermometer size={16} className="text-cyan-500" />;
      case 'Iluminação': return <Sun size={16} className="text-amber-500" />;
      default: return <Package size={16} className="text-slate-500" />;
    }
  };

  const getFamilyName = (item: QuoteItem): string => {
    const marca = (item.marca || '').toLowerCase();
    const nome = (item.nome_produto || '').toLowerCase();

    for (const [family, brands] of Object.entries(AUTOMOTIVE_FAMILIES)) {
      if (brands.some(b => marca.includes(b))) return family;
    }

    if (nome.match(/freio|disco|pastilha|lonas|cilindro/)) return 'Sistema de Freios';
    if (nome.match(/amortecedor|pivo|braço|terminal|caixa direção|batente|mola/)) return 'Suspensão & Direção';
    if (nome.match(/embreagem|platô|disco emb|rolamento|tulipa|homocinetica/)) return 'Transmissão & Embreagem';
    if (nome.match(/filtro|oleo|pistão|valvula|correia|tensor|bomba d'agua/)) return 'Motor & Filtragem';
    if (nome.match(/vela|bobina|cabo ignição|alternador|motor partida|bateria/)) return 'Elétrica & Ignição';
    if (nome.match(/radiador|aditivo|reservatorio|eletroventilador/)) return 'Arrefecimento';
    if (nome.match(/farol|lanterna|lampada|pisca/)) return 'Iluminação';
    
    return 'Outros Componentes';
  };

  const validItems = items.filter(i => i.nome_produto && i.preco_unitario !== null);

  const groupedData = useMemo(() => {
    const families: Record<string, Record<string, QuoteItem[]>> = {};

    validItems.forEach(item => {
      const family = getFamilyName(item);
      const productKey = normalizeProductName(item.nome_produto);

      if (!families[family]) families[family] = {};
      if (!families[family][productKey]) families[family][productKey] = [];
      
      families[family][productKey].push(item);
    });

    return families;
  }, [validItems]);

  const selectedBySupplier = useMemo(() => {
    const selected = items.filter(i => i.selected);
    const groups: Record<string, QuoteItem[]> = {};
    selected.forEach(item => {
      const supplier = item.nome_fornecedor || 'Desconhecido';
      if (!groups[supplier]) groups[supplier] = [];
      groups[supplier].push(item);
    });
    return groups;
  }, [items]);

  const totalSavings = useMemo(() => {
    let savings = 0;
    Object.values(groupedData).forEach(products => {
      Object.values(products).forEach(group => {
        const selected = group.find(i => i.selected);
        if (selected) {
          const maxPrice = Math.max(...group.map(i => i.preco_unitario || 0));
          savings += (maxPrice - (selected.preco_unitario || 0));
        }
      });
    });
    return savings;
  }, [groupedData]);

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const sendEmailToSupplier = (supplier: string, supplierItems: QuoteItem[]) => {
    const subject = encodeURIComponent(`Pedido de Peças - AutoQuote AI - Ref: ${new Date().toLocaleDateString('pt-BR')}`);
    const itemsList = supplierItems.map(i => `- ${i.nome_produto} (${i.marca}): ${formatCurrency(i.preco_unitario)}`).join('%0D%0A');
    const total = supplierItems.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);
    
    const body = encodeURIComponent(
      `Olá, Equipe ${supplier},%0D%0A%0D%0AGostaria de formalizar o pedido das seguintes peças cotadas via AutoQuote AI:%0D%0A%0D%0A${itemsList}%0D%0A%0D%0ATOTAL DO PEDIDO: ${formatCurrency(total)}%0D%0A%0D%0APor favor, confirmem a disponibilidade e enviem o link de pagamento ou boleto.%0D%0A%0D%0AAtenciosamente,%0D%0AOficina Parceira`
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const downloadAllOrders = () => {
    Object.entries(selectedBySupplier).forEach(([supplier, supplierItems], index) => {
      setTimeout(() => {
        exportSupplierOrder(supplier, supplierItems);
      }, index * 500);
    });
  };

  if (validItems.length === 0) {
    return (
      <div className="bg-white rounded-[2rem] border border-slate-200 p-16 text-center">
        <ShoppingCart className="mx-auto text-slate-200 mb-4" size={64} />
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Sem dados para comparação</h3>
        <p className="text-slate-500 mt-2 font-medium max-w-xs mx-auto">
          Processe cotações na aba "Extrair Dados" para ver a análise de Tiers aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 animate-in fade-in duration-700">
      {/* Header Fixo e Compacto com Insight de Economia */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 pointer-events-none" />
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">Inteligência de Tiers</h2>
          <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
            <Percent size={14} className="text-emerald-500" />
            {totalSavings > 0 ? (
              <>Você está economizando <span className="text-emerald-600 font-bold">{formatCurrency(totalSavings)}</span> nas escolhas atuais.</>
            ) : (
              'Analise marcas equivalentes para reduzir custos sem perder qualidade.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 z-10">
          <button 
            onClick={selectAllWinners}
            className="flex items-center gap-3 bg-slate-100 text-slate-900 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-slate-200 transition-all"
          >
            <Trophy size={16} /> Melhores Tiers
          </button>
          <button 
            onClick={() => exportToExcel(items)}
            className="flex items-center gap-3 bg-blue-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all"
          >
            <FileSpreadsheet size={16} /> Mapa Geral
          </button>
        </div>
      </div>

      {Object.entries(groupedData).map(([familyName, products]) => (
        <section key={familyName} className="space-y-4">
          <div className="flex items-center gap-4 px-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              {getFamilyIcon(familyName)}
            </div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{familyName}</h3>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>

          <div className="space-y-4">
            {Object.entries(products).map(([productKey, group]) => {
              const sorted = [...group].sort((a, b) => (a.preco_unitario || 0) - (b.preco_unitario || 0));
              const premiumItems = group.filter(i => isPremium(i.marca)).sort((a, b) => (a.preco_unitario || 0) - (b.preco_unitario || 0));
              const recommended = premiumItems[0] || sorted[0];
              
              // Calcula gap entre premium
              const maxPremiumPrice = premiumItems.length > 0 ? Math.max(...premiumItems.map(p => p.preco_unitario || 0)) : 0;
              const savingsPotential = maxPremiumPrice - (recommended.preco_unitario || 0);

              return (
                <div key={productKey} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm hover:border-blue-200 transition-all group/card">
                  <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                        <Package size={20} className="text-blue-500" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight block leading-none">{group[0].nome_produto}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.length} fornecedores</span>
                      </div>
                    </div>
                    {savingsPotential > 10 && (
                      <div className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] flex items-center gap-2 animate-pulse">
                        <TrendingUp size={12} /> Economia de {formatCurrency(savingsPotential)} em Tiers equivalentes
                      </div>
                    )}
                  </div>

                  <div className="divide-y divide-slate-50">
                    {sorted.map((item) => {
                      const isBestPremium = item.id === recommended.id;
                      const isItemPremium = isPremium(item.marca);

                      return (
                        <div 
                          key={item.id} 
                          onClick={() => toggleSelection(item.id)}
                          className={`group flex items-center justify-between px-6 py-4 cursor-pointer transition-all hover:bg-slate-50 ${item.selected ? 'bg-emerald-50/40' : ''}`}
                        >
                          <div className="flex items-center gap-6 flex-1">
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${item.selected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 group-hover:border-blue-400'}`}>
                              {item.selected && <CheckCircle2 size={12} />}
                            </div>

                            <div className="flex items-center gap-8 flex-1">
                              <div className="w-48">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-black uppercase tracking-tight ${isBestPremium ? 'text-blue-600' : 'text-slate-800'}`}>
                                    {item.marca}
                                  </span>
                                  {isItemPremium ? (
                                    <ShieldCheck size={14} className="text-blue-400" title="Tier Premium" />
                                  ) : (
                                    <AlertTriangle size={14} className="text-amber-400 opacity-40" title="Tier Econômico" />
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Store size={12} className="text-slate-300" />
                                  <span className="text-[10px] font-medium text-slate-400 uppercase truncate max-w-[120px]">{item.nome_fornecedor}</span>
                                </div>
                              </div>

                              <div className="hidden xl:flex items-center gap-3">
                                {isBestPremium && isItemPremium && (
                                  <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 border border-blue-200">
                                    <Zap size={10} /> Compra Inteligente
                                  </span>
                                )}
                                {!isItemPremium && (item.preco_unitario || 0) > (recommended.preco_unitario || 0) * 0.9 && (
                                  <span className="bg-amber-50 text-amber-600 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border border-amber-100">
                                    Custo/Benefício Baixo
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex items-center gap-6">
                            <div>
                              <p className={`text-lg font-black tracking-tighter ${isBestPremium ? 'text-blue-600' : 'text-slate-900'}`}>
                                {formatCurrency(item.preco_unitario)}
                              </p>
                              {item.preco_unitario !== null && recommended.preco_unitario !== null && item.preco_unitario > recommended.preco_unitario && (
                                <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest">
                                  +{formatCurrency(item.preco_unitario - recommended.preco_unitario)}
                                </p>
                              )}
                            </div>
                            <div className={`p-2 rounded-xl transition-all ${item.selected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300 group-hover:bg-blue-600 group-hover:text-white'}`}>
                              <ChevronRight size={18} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Resumo de Fechamento de Pedidos */}
      {Object.keys(selectedBySupplier).length > 0 && (
        <div className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
          <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-8">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
                <CheckCircle2 size={12} /> Seleção Final Consolidada
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tight">Fechamento por Fornecedor</h3>
            </div>
            <div className="flex gap-8">
              <div className="text-right border-r border-white/10 pr-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Economia Gerada</p>
                <p className="text-2xl font-black text-emerald-400">{formatCurrency(totalSavings)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Investimento Líquido</p>
                <p className="text-4xl font-black text-white">
                  {formatCurrency(items.filter(i => i.selected).reduce((acc, i) => acc + (i.preco_unitario || 0), 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(selectedBySupplier).map(([supplier, supplierItems]) => {
              const total = supplierItems.reduce((acc, i) => acc + (i.preco_unitario || 0), 0);
              return (
                <div key={supplier} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                        <Store size={20} />
                      </div>
                      <div className="max-w-[140px]">
                        <p className="text-sm font-black uppercase truncate">{supplier}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{supplierItems.length} peças</p>
                      </div>
                    </div>
                    <p className="text-lg font-black">{formatCurrency(total)}</p>
                  </div>
                  
                  <div className="flex gap-2 mt-6">
                    <button 
                      onClick={() => sendEmailToSupplier(supplier, supplierItems)}
                      className="flex-1 bg-white text-slate-900 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-400 hover:text-white transition-all"
                    >
                      <Mail size={14} /> E-mail
                    </button>
                    <button 
                      onClick={() => exportSupplierOrder(supplier, supplierItems)}
                      className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all text-slate-300"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 pt-10 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-4 rounded-2xl">
                <Lightbulb size={32} />
              </div>
              <p className="text-slate-400 text-sm font-medium max-w-xl leading-relaxed">
                As sugestões de <span className="text-white font-bold italic">"Compra Inteligente"</span> priorizam marcas Premium que estão com preços abaixo da média do mercado para aquela família de peças.
              </p>
            </div>
            <button 
              onClick={downloadAllOrders}
              className="bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-emerald-900/40 hover:bg-emerald-400 transition-all flex items-center gap-3 active:scale-95"
            >
              <Download size={20} /> Baixar Pedidos Separados
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonView;
