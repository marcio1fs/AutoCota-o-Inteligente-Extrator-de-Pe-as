
import React, { useState, useRef } from 'react';
import { FileText, Send, Loader2, CheckCircle2, AlertCircle, Upload, X, FileCheck, Image as ImageIcon, Sparkles, FileSpreadsheet } from 'lucide-react';
import { extractQuotesFromText, FileData } from '../services/geminiService';
import { QuoteItem } from '../types';
import * as XLSX from 'xlsx';

interface QuoteExtractorProps {
  onItemsExtracted: (items: QuoteItem[]) => void;
}

const QuoteExtractor: React.FC<QuoteExtractorProps> = ({ onItemsExtracted }) => {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const parseExcelFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          let fullText = '';
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(worksheet);
            fullText += `--- Planilha: ${sheetName} ---\n${csv}\n\n`;
          });
          
          resolve(fullText);
        } catch (err) {
          reject(new Error("Falha ao ler o arquivo Excel. Verifique se o arquivo não está corrompido."));
        }
      };
      reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleProcess = async () => {
    if (!inputText.trim() && !selectedFile) {
      setError("Por favor, digite um texto ou selecione um arquivo.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let fileData: FileData | undefined;
      let combinedText = inputText;

      if (selectedFile) {
        const isExcel = selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                        selectedFile.type === 'application/vnd.ms-excel' ||
                        selectedFile.name.endsWith('.xlsx') || 
                        selectedFile.name.endsWith('.xls');

        if (isExcel) {
          // Arquivos Excel são convertidos em texto localmente
          const excelText = await parseExcelFile(selectedFile);
          combinedText = `DADOS EXTRAÍDOS DE PLANILHA:\n${excelText}\n\n${combinedText}`;
        } else {
          // Imagens e PDFs são enviados como inlineData (multimodal)
          const base64 = await fileToBase64(selectedFile);
          fileData = {
            base64,
            mimeType: selectedFile.type
          };
        }
      }

      const results = await extractQuotesFromText(combinedText, fileData);
      onItemsExtracted(results);
      setInputText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isExcelFile = selectedFile?.name.endsWith('.xlsx') || selectedFile?.name.endsWith('.xls');

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-900/20">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Entrada de Dados</h2>
              <p className="text-slate-500 text-sm font-medium">Arquivos ou textos de cotação.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col gap-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Texto Adicional ou Observações</label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite aqui ou cole o texto da cotação..."
              className="w-full h-full min-h-[250px] p-6 rounded-[2rem] border-2 border-slate-100 focus:border-blue-500 bg-slate-50/50 resize-none transition-all outline-none text-slate-700 font-medium placeholder:text-slate-300"
            />
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Upload de Documento (PDF/Imagens/Excel)</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 min-h-[250px] border-4 border-dashed rounded-[2rem] transition-all flex flex-col items-center justify-center p-8 cursor-pointer group ${
                selectedFile 
                ? 'border-emerald-200 bg-emerald-50/30' 
                : 'border-slate-100 bg-slate-50/30 hover:border-blue-200 hover:bg-blue-50/30'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="application/pdf,image/*,.xlsx,.xls"
              />
              
              {!selectedFile ? (
                <>
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:scale-110 transition-all mb-4">
                    <Upload size={32} />
                  </div>
                  <p className="text-slate-600 font-black uppercase text-xs tracking-widest text-center">Clique ou Arraste um arquivo</p>
                  <p className="text-slate-400 text-[10px] mt-2 font-medium">PDF, JPG, PNG ou EXCEL</p>
                </>
              ) : (
                <div className="flex flex-col items-center animate-in zoom-in-95 duration-300 text-center">
                  <div className={`w-20 h-20 text-white rounded-3xl shadow-xl flex items-center justify-center mb-4 relative ${isExcelFile ? 'bg-blue-500 shadow-blue-900/20' : 'bg-emerald-500 shadow-emerald-900/20'}`}>
                    {selectedFile.type.includes('image') ? <ImageIcon size={32} /> : isExcelFile ? <FileSpreadsheet size={32} /> : <FileCheck size={32} />}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if(fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute -top-2 -right-2 bg-white text-red-500 p-1.5 rounded-xl shadow-md hover:bg-red-50 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-slate-800 font-bold text-sm truncate max-w-[200px]">{selectedFile.name}</p>
                  <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isExcelFile ? 'text-blue-600' : 'text-emerald-600'}`}>
                    {isExcelFile ? 'Planilha Identificada' : 'Documento Pronto'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-8 p-5 bg-red-50 text-red-700 rounded-2xl flex items-center gap-4 border border-red-100 animate-in slide-in-from-top-2">
            <AlertCircle size={24} />
            <p className="text-sm font-bold uppercase tracking-tight">{error}</p>
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <button
            onClick={handleProcess}
            disabled={loading || (!inputText.trim() && !selectedFile)}
            className={`flex items-center gap-4 px-12 py-5 rounded-[2rem] font-black uppercase text-sm tracking-[0.15em] transition-all shadow-2xl ${
              loading || (!inputText.trim() && !selectedFile)
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/30 hover:-translate-y-1'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Extraindo com IA...
              </>
            ) : (
              <>
                <Send size={20} />
                Processar Cotação
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuoteExtractor;
