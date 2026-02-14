
import React, { Suspense, lazy, useState, useEffect, useMemo, startTransition } from 'react';
import Sidebar from './components/Sidebar';
import QuoteExtractor from './components/QuoteExtractor';
import QuoteTable from './components/QuoteTable';
import { QuoteItem, AppView } from './types';
import { recordScreenMetric, startPerformanceMonitor, startScreenMetricsReporter } from './services/performanceMonitor';
import LoginView from './components/LoginView';
import { clearAuthToken, login, setAuthToken, validateSession } from './services/authService';
// Fixed missing ShoppingCart import
import { Package, DollarSign, FileSpreadsheet, MessageSquare, ShoppingCart, Send, Trash2, LogOut } from 'lucide-react';

const ComparisonView = lazy(() => import('./components/ComparisonView'));
const OrderHistoryView = lazy(() => import('./components/OrderHistoryView'));
const Chatbot = lazy(() => import('./components/Chatbot'));
const OrderSummary = lazy(() => import('./components/OrderSummary'));
const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const QUOTE_SESSION_KEY = 'auto_quote_session_id_v1';

const createQuoteSessionId = () => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `quote-${Date.now()}-${randomPart}`;
};

const normalizeQuantity = (value?: number | null) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(Number(value)));
};

const ViewLoadingFallback = () => (
  <div className="bg-white rounded-[2rem] border border-slate-200 p-10 text-sm font-semibold text-slate-500">
    Carregando...
  </div>
);

const viewLabelMap: Record<AppView, string> = {
  [AppView.DASHBOARD]: 'dashboard',
  [AppView.EXTRACTOR]: 'extractor',
  [AppView.COMPARISON]: 'comparison',
  [AppView.HISTORY]: 'history',
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authUser, setAuthUser] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [quoteSessionId, setQuoteSessionId] = useState<string>(() => {
    const existing = localStorage.getItem(QUOTE_SESSION_KEY);
    if (existing) return existing;

    const next = createQuoteSessionId();
    localStorage.setItem(QUOTE_SESSION_KEY, next);
    return next;
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isOrderSummaryOpen, setIsOrderSummaryOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      try {
        const user = await validateSession();
        if (!active) return;
        setIsAuthenticated(true);
        setAuthUser(user.username);
      } catch {
        if (!active) return;
        clearAuthToken();
        setIsAuthenticated(false);
        setAuthUser('');
      } finally {
        if (active) setIsAuthChecking(false);
      }
    };

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('auto_quotes_v2');
    if (saved) setItems(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const isDev = import.meta.env.DEV;
    const perfMonitorEnabled = (import.meta.env.VITE_PERF_MONITOR || 'true') === 'true';

    if (!isDev || !perfMonitorEnabled) return;

    const stopReporter = startScreenMetricsReporter(15000);
    return () => stopReporter();
  }, []);

  useEffect(() => {
    const isDev = import.meta.env.DEV;
    const perfMonitorEnabled = (import.meta.env.VITE_PERF_MONITOR || 'true') === 'true';

    if (!isDev || !perfMonitorEnabled) {
      return;
    }

    const stopMonitor = startPerformanceMonitor({
      longTaskThresholdMs: 60,
      eventDurationThresholdMs: 90,
      logLayoutShift: false,
    });

    return () => {
      stopMonitor();
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      localStorage.setItem('auto_quotes_v2', JSON.stringify(items));
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [items]);

  useEffect(() => {
    localStorage.setItem(QUOTE_SESSION_KEY, quoteSessionId);
  }, [quoteSessionId]);

  const measureInteraction = (action: string, startedAt: number, details?: Record<string, unknown>) => {
    const screen = viewLabelMap[view] || 'unknown';

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        recordScreenMetric(screen, action, performance.now() - startedAt, {
          warnThresholdMs: 120,
          details,
        });
      });
    });
  };

  const handleItemsExtracted = (newItems: QuoteItem[]) => {
    const startedAt = performance.now();
    startTransition(() => {
      setItems(prev => [...prev, ...newItems]);
      setView(AppView.DASHBOARD);
    });
    measureInteraction('items_extracted', startedAt, { itemsAdded: newItems.length });
  };

  const removeItem = (id: string) => {
    const startedAt = performance.now();
    startTransition(() => {
      setItems(prev => prev.filter(item => item.id !== id));
    });
    measureInteraction('remove_item', startedAt);
  };

  const toggleSelection = (id: string) => {
    const startedAt = performance.now();
    startTransition(() => {
      setItems(prev => {
        const index = prev.findIndex(item => item.id === id);
        if (index < 0) return prev;

        const current = prev[index];
        const next = [...prev];
        next[index] = { ...current, selected: !current.selected };
        return next;
      });
    });
    measureInteraction('toggle_selection', startedAt);
  };

  const updateItemQuantity = (id: string, quantity: number) => {
    const startedAt = performance.now();
    const nextQuantity = normalizeQuantity(quantity);
    startTransition(() => {
      setItems(prev => {
        const index = prev.findIndex(item => item.id === id);
        if (index < 0) return prev;

        const current = prev[index];
        const currentQuantity = normalizeQuantity(current.quantidade);
        if (currentQuantity === nextQuantity) return prev;

        const next = [...prev];
        next[index] = { ...current, quantidade: nextQuantity };
        return next;
      });
    });
    measureInteraction('update_quantity', startedAt);
  };

  const selectWinners = () => {
    const startedAt = performance.now();
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

    startTransition(() => {
      setItems(prev => prev.map(item => ({
        ...item,
        selected: winnersIds.has(item.id)
      })));
    });
    measureInteraction('select_winners', startedAt, { groups: Object.keys(grouped).length });
  };

  const clearScreenForNewQuote = () => {
    if (items.length === 0) return;

    const confirmed = window.confirm('Deseja limpar todos os itens da tela para iniciar uma nova cotação?');
    if (!confirmed) return;

    const startedAt = performance.now();

    startTransition(() => {
      setItems([]);
      setView(AppView.DASHBOARD);
    });

    setQuoteSessionId(createQuoteSessionId());
    setIsOrderSummaryOpen(false);
    setIsChatOpen(false);
    localStorage.removeItem('auto_quotes_v2');

    measureInteraction('clear_screen', startedAt);
  };

  const startNewChatSession = () => {
    setQuoteSessionId(createQuoteSessionId());
  };

  const handleLogin = async (username: string, password: string) => {
    setAuthError('');
    setAuthLoading(true);

    try {
      const response = await login(username, password);
      setAuthToken(response.token);
      setIsAuthenticated(true);
      setAuthUser(response.user.username);
    } catch (error: any) {
      clearAuthToken();
      setIsAuthenticated(false);
      setAuthUser('');
      setAuthError(error?.message || 'Falha ao fazer login.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setIsAuthenticated(false);
    setAuthUser('');
    setAuthError('');
    setIsChatOpen(false);
    setIsOrderSummaryOpen(false);
  };

  const selectedItems = useMemo(() => items.filter(i => i.selected), [items]);
  const totalValue = useMemo(
    () => items.reduce((acc, i) => acc + (i.preco_unitario || 0), 0),
    [items]
  );
  const cartValue = selectedItems.reduce((acc, i) => {
    const quantity = normalizeQuantity(i.quantidade);
    return acc + (i.preco_unitario || 0) * quantity;
  }, 0);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-semibold">
        Validando sessão...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onSubmit={handleLogin} loading={authLoading} error={authError} />;
  }

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
              {view === AppView.HISTORY && 'Histórico de Pedidos'}
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
                <p className="text-lg font-black text-slate-900 leading-tight">{BRL_FORMATTER.format(cartValue)}</p>
              </div>
            </div>

            {selectedItems.length > 0 && (
              <button 
                onClick={() => setIsOrderSummaryOpen(true)}
                className="bg-emerald-600 text-white px-6 py-3 rounded-2xl flex items-center gap-3 font-bold hover:bg-emerald-700 hover:-translate-y-1 transition-all shadow-xl shadow-emerald-900/20"
              >
                <Send size={20} />
                <span>Finalizar Pedido</span>
              </button>
            )}

            {items.length > 0 && (
              <button
                onClick={clearScreenForNewQuote}
                className="bg-red-50 text-red-600 border border-red-200 px-5 py-3 rounded-2xl flex items-center gap-2 font-bold hover:bg-red-100 hover:-translate-y-1 transition-all"
                title="Limpar tela para iniciar nova cotação"
              >
                <Trash2 size={18} />
                <span>Limpar Tela</span>
              </button>
            )}
            
            <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-2xl shadow-blue-900/30 flex items-center justify-center hover:bg-blue-700 hover:-translate-y-1 transition-all"
            >
              <MessageSquare size={28} />
            </button>

            <button
              onClick={handleLogout}
              className="bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold hover:bg-slate-800 hover:-translate-y-1 transition-all"
              title={`Sair (${authUser})`}
            >
              <LogOut size={18} />
              <span>Sair</span>
            </button>
          </div>
        </header>

        {view === AppView.DASHBOARD && (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: 'Valor Total Cotado', value: BRL_FORMATTER.format(totalValue), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-100' },
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

            {items.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={clearScreenForNewQuote}
                  className="bg-red-50 text-red-600 border border-red-200 px-5 py-3 rounded-2xl flex items-center gap-2 font-bold hover:bg-red-100 transition-all"
                  title="Limpar tela para iniciar nova cotação"
                >
                  <Trash2 size={18} />
                  <span>Limpar Tela</span>
                </button>
              </div>
            )}

            <QuoteTable items={items} onRemoveItem={removeItem} toggleSelection={toggleSelection} />
          </div>
        )}

        {view === AppView.EXTRACTOR && <QuoteExtractor onItemsExtracted={handleItemsExtracted} />}
        {view === AppView.COMPARISON && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <ComparisonView
              items={items}
              toggleSelection={toggleSelection}
              selectAllWinners={selectWinners}
              updateItemQuantity={updateItemQuantity}
              onClearScreen={clearScreenForNewQuote}
            />
          </Suspense>
        )}
        {view === AppView.HISTORY && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <OrderHistoryView />
          </Suspense>
        )}
        
        {isChatOpen && (
          <div className="fixed bottom-6 right-6 w-96 z-50">
             <Suspense fallback={<ViewLoadingFallback />}>
               <Chatbot
                 isOpen={isChatOpen}
                 onClose={() => setIsChatOpen(false)}
                 items={items}
                 sessionId={quoteSessionId}
                 onNewSession={startNewChatSession}
               />
             </Suspense>
          </div>
        )}

        {isOrderSummaryOpen && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <OrderSummary 
              items={selectedItems} 
              onClose={() => setIsOrderSummaryOpen(false)} 
            />
          </Suspense>
        )}
      </main>
    </div>
  );
};

export default App;
