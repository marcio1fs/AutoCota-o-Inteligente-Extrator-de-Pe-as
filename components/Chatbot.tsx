
import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { QuoteItem } from '../types';
import { getSupportAgentResponseWithMetadata } from '../services/supportAgentService';
import { clearChatMemory, loadChatMemory, saveChatMemory } from '../services/chatMemoryService';

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  items: QuoteItem[];
  sessionId: string;
  onNewSession: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const INITIAL_BOT_MESSAGE = 'Olá! Sou seu assistente AutoQuote do sistema completo. Posso ajudar em dúvidas de uso, cálculos, envio SMTP, IA (Gemini/OpenRouter), histórico e diagnóstico de erros. Como posso ajudar?';

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onClose, items, sessionId, onNewSession }) => {
  const [messages, setMessages] = useState<Message[]>([{ role: 'model', text: INITIAL_BOT_MESSAGE }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastIntent, setLastIntent] = useState<string>('');
  const [lastActionPlan, setLastActionPlan] = useState<string>('');
  const [hydratedSessionId, setHydratedSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const memory = loadChatMemory(sessionId);

    if (!memory || memory.messages.length === 0) {
      setMessages([{ role: 'model', text: INITIAL_BOT_MESSAGE }]);
      setLastIntent('');
      setLastActionPlan('');
      setHydratedSessionId(sessionId);
      return;
    }

    setMessages(memory.messages.map(msg => ({ role: msg.role, text: msg.text })));
    setLastIntent(memory.lastIntent || '');
    setLastActionPlan(memory.lastActionPlan || '');
    setHydratedSessionId(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (hydratedSessionId !== sessionId) return;

    saveChatMemory({
      messages,
      lastIntent,
      lastActionPlan,
    }, sessionId);
  }, [messages, lastIntent, lastActionPlan, sessionId, hydratedSessionId]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const response = await getSupportAgentResponseWithMetadata(userMessage, { items });
      setLastIntent(response.intent);
      setLastActionPlan(response.actionPlan);

      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Houve um erro ao processar sua mensagem." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300 z-50">
      {/* Header */}
      <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm">Assistente AutoQuote</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-slate-400 font-medium">Online e Inteligente</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setInput('');
              setLoading(false);
              onNewSession();
            }}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Iniciar nova sessão de chat"
          >
            Nova sessão
          </button>
          <button
            onClick={() => {
              clearChatMemory(sessionId);
              setMessages([{ role: 'model', text: INITIAL_BOT_MESSAGE }]);
              setLastIntent('');
              setLastActionPlan('');
            }}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Limpar conversa"
          >
            Limpar
          </button>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-slate-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-slate-900 text-white'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none flex items-center gap-2 shadow-sm">
              <Loader2 className="animate-spin text-blue-600" size={16} />
              <span className="text-xs text-slate-500 font-medium">Analisando cotações...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre as peças ou fornecedores..."
            className="w-full pl-4 pr-12 py-3 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${!input.trim() || loading ? 'text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-900/20'}`}
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
          Dica: Pergunte "erro 500 no envio", "cota 429" ou "como fechar pedido sem erro".
        </p>
      </div>
    </div>
  );
};

export default Chatbot;
