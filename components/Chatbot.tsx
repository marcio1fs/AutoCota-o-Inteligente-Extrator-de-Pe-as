
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Send, X, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { QuoteItem } from '../types';

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  items: QuoteItem[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onClose, items }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Olá! Sou seu assistente AutoQuote. Posso te ajudar a analisar as cotações, encontrar o melhor preço ou sugerir marcas. Como posso ajudar?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      // Corrected initialization: use named parameter for apiKey and obtain directly from process.env.API_KEY
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const contextSummary = items.length > 0 
        ? `Temos ${items.length} cotações registradas. Itens: ${items.map(i => `${i.nome_produto} (${i.marca}) por ${i.preco_unitario} no fornecedor ${i.nome_fornecedor}`).join(', ')}.`
        : "Não há cotações registradas no momento.";

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [{ text: `${contextSummary}\n\nUsuário pergunta: ${userMessage}` }] }
        ],
        config: {
          systemInstruction: `Você é o assistente inteligente do AutoQuote AI. 
          Seu objetivo é ajudar o usuário a analisar cotações de peças automotivas.
          Responda sempre em Português do Brasil.
          Seja conciso, profissional e use formatação markdown quando útil (negrito para preços ou fornecedores).
          Se o usuário perguntar sobre o "melhor preço", procure nos dados fornecidos o menor valor para aquele item específico.
          Sempre que citar marcas premium como Bosch, TRW, Mahle, LUK, Cofap, mencione que são de excelente qualidade.`,
          temperature: 0.7,
        }
      });

      // Directly access .text property from response
      const aiText = response.text || "Desculpe, não consegui processar sua solicitação.";
      setMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Houve um erro ao conectar com minha inteligência. Tente novamente em instantes." }]);
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
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
          <X size={20} />
        </button>
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
          Dica: Pergunte "Qual o melhor preço para kit de embreagem?"
        </p>
      </div>
    </div>
  );
};

export default Chatbot;
