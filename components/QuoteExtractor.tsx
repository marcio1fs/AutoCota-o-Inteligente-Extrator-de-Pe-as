
import React, { useState } from 'react';
import { FileText, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { extractQuotesFromText } from '../services/geminiService';
import { QuoteItem } from '../types';

interface QuoteExtractorProps {
  onItemsExtracted: (items: QuoteItem[]) => void;
}

const QuoteExtractor: React.FC<QuoteExtractorProps> = ({ onItemsExtracted }) => {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const results = await extractQuotesFromText(inputText);
      onItemsExtracted(results);
      setInputText('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadExample = () => {
    setInputText(`COTAÇÃO DE PEÇAS - AUTO CENTER SUL
Vendedor: Marcos Silva
Data: 22/10/2023

Item 1: Pastilha de Freio Dianteira - Marca: Bosch - R$ 185,50
Item 2: Disco de Freio Ventilado - Marca: Fremax - R$ 240,00 cada
Item 3: Filtro de Óleo - Marca: Mann - R$ 45,90

Outro fornecedor: PEÇAS RÁPIDAS LTDA
Produto: Pastilha Freio Dianteira - Bosch - Preço: 178,00
Produto: Filtro Óleo PH5962 - Fram - Preço: 39,00`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-800">
            <FileText className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold">Nova Cotação</h2>
          </div>
          <button 
            onClick={loadExample}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Carregar Exemplo
          </button>
        </div>
        
        <p className="text-slate-500 text-sm mb-4">
          Cole o texto da cotação (e-mail, texto de PDF ou planilha) abaixo. Nossa IA irá identificar automaticamente os itens, marcas e preços.
        </p>

        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ex: Cotação da loja X: 2 Amortecedores Cofap por R$ 500,00..."
          className="w-full h-64 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all outline-none"
        />

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleProcess}
            disabled={loading || !inputText.trim()}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg ${
              loading || !inputText.trim()
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/20'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Processando...
              </>
            ) : (
              <>
                <Send size={20} />
                Extrair Itens
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 text-blue-800 mb-1">
            <CheckCircle2 size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Passo 1</span>
          </div>
          <p className="text-sm text-blue-700">Copie o texto dos fornecedores</p>
        </div>
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
          <div className="flex items-center gap-2 text-indigo-800 mb-1">
            <CheckCircle2 size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Passo 2</span>
          </div>
          <p className="text-sm text-indigo-700">Deixe a IA estruturar os dados</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-2 text-emerald-800 mb-1">
            <CheckCircle2 size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Passo 3</span>
          </div>
          <p className="text-sm text-emerald-700">Compare e escolha o melhor preço</p>
        </div>
      </div>
    </div>
  );
};

export default QuoteExtractor;
