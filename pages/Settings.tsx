import React, { useState } from 'react';
import { Database, Trash2, Save, Server, Calendar, RefreshCw, AlertTriangle } from 'lucide-react';
import { clearDB, deleteOrdersByDateRange } from '../services/storageService';

interface SettingsProps {
  onRefreshData: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onRefreshData }) => {
  // Configuração de Fonte de Dados
  const [dataSource, setDataSource] = useState<'local' | 'api'>('local');
  const [apiUrl, setApiUrl] = useState('https://api.conferex-logistica.com/v1');
  const [isSaved, setIsSaved] = useState(false);

  // Limpeza de Dados
  const [cleanMode, setCleanMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveConfig = () => {
    // Simula salvamento de preferências
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    // Em uma app real, isso salvaria no localStorage ou Context
    localStorage.setItem('app_data_source', dataSource);
    if (dataSource === 'api') {
        localStorage.setItem('app_api_url', apiUrl);
    }
  };

  const handleClearData = async () => {
    if (!confirm("Tem certeza? Esta ação removerá permanentemente os registros de conferências finalizadas do período selecionado.")) {
        return;
    }

    setLoading(true);
    try {
        let start: Date, end: Date;

        if (cleanMode === 'month') {
            const [year, month] = selectedMonth.split('-');
            start = new Date(parseInt(year), parseInt(month) - 1, 1);
            end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59); // Último dia do mês
        } else {
            if (!startDate || !endDate) {
                alert("Selecione as datas de início e fim.");
                setLoading(false);
                return;
            }
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        }

        const deletedCount = await deleteOrdersByDateRange(start, end);
        alert(`${deletedCount} registros de conferências foram removidos com sucesso.`);
        onRefreshData(); // Atualiza o App.tsx
    } catch (error) {
        console.error(error);
        alert("Erro ao limpar dados.");
    } finally {
        setLoading(false);
    }
  };

  const handleFactoryReset = async () => {
      const confirmation = prompt("ATENÇÃO: Isso apagará TODOS os pedidos, configurações e histórico do dispositivo. Digite 'ZERAR' para confirmar.");
      if (confirmation === 'ZERAR') {
          try {
              await clearDB();
              alert("Banco de dados reiniciado. O aplicativo será recarregado.");
              window.location.reload();
          } catch (e) {
              alert("Erro ao zerar banco de dados.");
          }
      }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Configurações</h2>
      <p className="text-gray-500 mb-8">Gerencie a conexão de dados e a manutenção do sistema.</p>

      {/* Seção 1: Fonte de Dados */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center">
            <Server className="text-brand-600 mr-3" size={24} />
            <div>
                <h3 className="font-bold text-gray-800">Conexão e Banco de Dados</h3>
                <p className="text-xs text-gray-500">Defina onde os dados dos pedidos serão armazenados.</p>
            </div>
        </div>
        <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                    onClick={() => setDataSource('local')}
                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center space-x-3 transition-all ${
                        dataSource === 'local' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-200'
                    }`}
                >
                    <Database size={24} className={dataSource === 'local' ? 'text-brand-600' : 'text-gray-400'} />
                    <div>
                        <span className="block font-bold text-gray-800">Banco Local (Offline)</span>
                        <span className="text-xs text-gray-500">IndexedDB - Ideal para operação sem internet.</span>
                    </div>
                </div>

                <div 
                    onClick={() => setDataSource('api')}
                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center space-x-3 transition-all ${
                        dataSource === 'api' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-200'
                    }`}
                >
                    <Server size={24} className={dataSource === 'api' ? 'text-brand-600' : 'text-gray-400'} />
                    <div>
                        <span className="block font-bold text-gray-800">API Remota (Cloud)</span>
                        <span className="text-xs text-gray-500">Sincronização em tempo real com servidor.</span>
                    </div>
                </div>
            </div>

            {dataSource === 'api' && (
                <div className="animate-in slide-in-from-top duration-300">
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL do Endpoint / Servidor</label>
                    <input 
                        type="text" 
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                </div>
            )}

            <div className="flex justify-end pt-2">
                <button 
                    onClick={handleSaveConfig}
                    className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium text-white transition-all ${isSaved ? 'bg-green-600' : 'bg-brand-600 hover:bg-brand-700'}`}
                >
                    {isSaved ? <RefreshCw className="animate-spin mr-1" size={18} /> : <Save size={18} />}
                    <span>{isSaved ? 'Salvando...' : 'Salvar Configuração'}</span>
                </button>
            </div>
        </div>
      </div>

      {/* Seção 2: Manutenção de Relatórios */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center">
                <Trash2 className="text-orange-600 mr-3" size={24} />
                <div>
                    <h3 className="font-bold text-gray-800">Limpeza de Histórico e Relatórios</h3>
                    <p className="text-xs text-gray-500">Remova dados antigos para liberar espaço e organizar relatórios.</p>
                </div>
            </div>
        </div>
        
        <div className="p-6">
             <div className="flex space-x-4 mb-6">
                <button 
                    onClick={() => setCleanMode('month')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${cleanMode === 'month' ? 'bg-orange-100 text-orange-800' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    Por Mês
                </button>
                <button 
                    onClick={() => setCleanMode('range')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${cleanMode === 'range' ? 'bg-orange-100 text-orange-800' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    Por Período
                </button>
             </div>

             <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col md:flex-row items-end gap-4">
                {cleanMode === 'month' ? (
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Selecione o Mês para Limpar</label>
                        <input 
                            type="month" 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>
                ) : (
                    <div className="flex-1 w-full grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                            <input 
                                type="date" 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                            <input 
                                type="date" 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                )}
                
                <button 
                    onClick={handleClearData}
                    disabled={loading}
                    className="w-full md:w-auto bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
                >
                    <Trash2 size={18} />
                    <span>{loading ? 'Processando...' : 'Excluir Registros'}</span>
                </button>
             </div>
             <p className="mt-2 text-xs text-gray-500 flex items-center">
                 <AlertTriangle size={12} className="mr-1" />
                 Atenção: Apenas conferências com status "Finalizado" ou "Com Erro" serão removidas. Pedidos pendentes são mantidos.
             </p>
        </div>
      </div>

      {/* Zona de Perigo */}
      <div className="border border-red-200 rounded-xl overflow-hidden">
          <div className="bg-red-50 p-4 border-b border-red-100">
              <h3 className="font-bold text-red-800 text-sm uppercase">Zona de Perigo</h3>
          </div>
          <div className="p-6 bg-white flex justify-between items-center">
              <div>
                  <h4 className="font-bold text-gray-800">Reset de Fábrica</h4>
                  <p className="text-sm text-gray-500">Apaga todos os dados locais, configurações e logs do dispositivo.</p>
              </div>
              <button 
                onClick={handleFactoryReset}
                className="bg-white border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                  Zerar Dados do App
              </button>
          </div>
      </div>

    </div>
  );
};

export default Settings;