import React, { useState } from 'react';
import { Car, Lock, User, LogIn } from 'lucide-react';

interface LoginViewProps {
  onSubmit: (username: string, password: string) => Promise<void>;
  loading: boolean;
  error: string;
}

const LoginView: React.FC<LoginViewProps> = ({ onSubmit, loading, error }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    await onSubmit(username.trim(), password);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-blue-600 p-3 rounded-xl text-white">
            <Car size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">AutoQuote AI</h1>
            <p className="text-sm text-slate-500 font-medium">Acesso restrito do sistema</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Usuário</span>
            <div className="mt-2 relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite seu usuário"
                autoComplete="username"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Senha</span>
            <div className="mt-2 relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
            </div>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginView;
