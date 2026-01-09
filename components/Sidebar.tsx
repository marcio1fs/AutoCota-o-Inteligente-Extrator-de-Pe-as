
import React from 'react';
import { LayoutDashboard, FileSearch, Scale, Settings, Car } from 'lucide-react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const menuItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: AppView.EXTRACTOR, label: 'Extrair Dados', icon: FileSearch },
    { id: AppView.COMPARISON, label: 'Comparar Preços', icon: Scale },
  ];

  return (
    <div className="w-64 bg-slate-900 h-screen fixed left-0 top-0 text-white flex flex-col">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-blue-600 p-2 rounded-lg">
          <Car size={24} />
        </div>
        <h1 className="text-xl font-bold tracking-tight">AutoQuote AI</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
          <Settings size={20} />
          <span className="font-medium">Configurações</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
