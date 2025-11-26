import React, { useState } from 'react';
import { Order, OrderStatus } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { Users, Truck, AlertOctagon, TrendingDown, Award, FileDown, RotateCcw, Lock, KeyRound } from 'lucide-react';

interface ReportsProps {
  orders: Order[];
}

const Reports: React.FC<ReportsProps> = ({ orders }) => {
  // Autenticação para Área Restrita
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      // Credenciais Padrão: admin / 8956
      if (username === 'admin' && password === '8956') {
          setIsAuthenticated(true);
          setAuthError('');
      } else {
          setAuthError('Credenciais inválidas. Tente novamente.');
      }
  };

  // Se não autenticado, mostra tela de bloqueio
  if (!isAuthenticated) {
      return (
          <div className="p-8 h-full flex items-center justify-center animate-in fade-in duration-500">
              <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200">
                  <div className="bg-brand-900 p-6 flex flex-col items-center justify-center text-white">
                      <div className="bg-brand-800 p-4 rounded-full mb-4 shadow-inner">
                          <Lock size={32} />
                      </div>
                      <h2 className="text-2xl font-bold">Área Restrita</h2>
                      <p className="text-brand-200 text-sm">Acesso exclusivo à gestão</p>
                  </div>
                  <div className="p-8">
                      <form onSubmit={handleLogin} className="space-y-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
                              <div className="relative">
                                  <Users className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                  <input 
                                      type="text" 
                                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                      placeholder="Usuário Master"
                                      value={username}
                                      onChange={e => setUsername(e.target.value)}
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Senha Mestra</label>
                              <div className="relative">
                                  <KeyRound className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                  <input 
                                      type="password" 
                                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                      placeholder="••••"
                                      value={password}
                                      onChange={e => setPassword(e.target.value)}
                                  />
                              </div>
                          </div>
                          
                          {authError && (
                              <div className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded">
                                  {authError}
                              </div>
                          )}

                          <button 
                              type="submit"
                              className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/30"
                          >
                              Desbloquear Relatórios
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      );
  }

  // --- Conteúdo Protegido (Relatórios) ---

  // Filtra apenas pedidos finalizados
  const completedOrders = orders.filter(o => 
    o.status === OrderStatus.COMPLETED || 
    o.status === OrderStatus.COMPLETED_WITH_ERRORS
  );

  // --- Lógica: Desempenho por Separador ---
  const separatorStats = new Map<string, { total: number, errors: number, perfect: number }>();

  completedOrders.forEach(order => {
    const separator = order.sessionData?.separatorName || 'N/A';
    if (!separatorStats.has(separator)) {
      separatorStats.set(separator, { total: 0, errors: 0, perfect: 0 });
    }
    
    const stats = separatorStats.get(separator)!;
    stats.total += 1;
    
    // Considera erro se o pedido terminou com status de erro (ou teve correções posteriores)
    if (order.status === OrderStatus.COMPLETED_WITH_ERRORS) {
      stats.errors += 1;
    } else {
      stats.perfect += 1;
    }
  });

  const separatorChartData = Array.from(separatorStats.entries()).map(([name, stats]) => ({
    name,
    Pedidos: stats.total,
    Divergencias: stats.errors,
    TaxaErro: stats.total > 0 ? ((stats.errors / stats.total) * 100).toFixed(1) : 0
  })).sort((a, b) => b.Divergencias - a.Divergencias);

  // --- Lógica: Cargas por Motorista ---
  const driverStats = new Map<string, { loads: number, items: number }>();

  completedOrders.forEach(order => {
    const driver = order.sessionData?.driverName || 'Não Informado';
    if (!driverStats.has(driver)) {
      driverStats.set(driver, { loads: 0, items: 0 });
    }
    const stats = driverStats.get(driver)!;
    stats.loads += 1;
    stats.items += order.items.reduce((acc, item) => acc + item.quantityScanned, 0);
  });

  const driverChartData = Array.from(driverStats.entries()).map(([name, stats]) => ({
    name,
    value: stats.loads,
    items: stats.items
  }));

  // --- Lógica: Logística Reversa (Retornos e Re-entregas) ---
  const returnStats = new Map<string, { returns: number }>();
  let totalRedirecionados = 0;
  
  // Lista Plana para Tabela de Devoluções
  const detailedReturnList: Array<{date: string, orderId: string, driver: string, reason: string}> = [];

  // Analisa histórico de TODOS os pedidos (mesmo os não completados, pois podem estar retornados agora)
  orders.forEach(order => {
      // Conta retornos por motorista baseando-se no histórico de devoluções
      if (order.returnHistory && order.returnHistory.length > 0) {
          order.returnHistory.forEach(ret => {
              if (!returnStats.has(ret.driverName)) {
                  returnStats.set(ret.driverName, { returns: 0 });
              }
              returnStats.get(ret.driverName)!.returns += 1;

              detailedReturnList.push({
                  date: ret.date,
                  orderId: order.id,
                  driver: ret.driverName,
                  reason: ret.reason
              });
          });

          // Se o pedido tem histórico de retorno mas agora está COMPLETED, foi "Redirecionado" e conferido novamente
          if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.COMPLETED_WITH_ERRORS) {
              totalRedirecionados += 1;
          }
      }
  });

  // Ordenar lista por data (mais recente primeiro)
  detailedReturnList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const returnsChartData = Array.from(returnStats.entries()).map(([name, stats]) => ({
      name,
      value: stats.returns
  })).sort((a, b) => b.value - a.value);

  const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444'];
  const RETURN_COLORS = ['#f97316', '#ea580c', '#c2410c', '#9a3412'];

  // --- Export Functions ---
  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSeparators = () => {
    const headers = ['Separador', 'Total Pedidos', 'Divergencias', 'Taxa de Erro (%)'];
    const rows = separatorChartData.map(item => 
      `"${item.name}",${item.Pedidos},${item.Divergencias},${item.TaxaErro}`
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadCSV(csvContent, `relatorio_separadores_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportDrivers = () => {
    const headers = ['Motorista', 'Total Entregas', 'Total Itens'];
    const rows = driverChartData.map(item => 
      `"${item.name}",${item.value},${item.items}`
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadCSV(csvContent, `relatorio_motoristas_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-20">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center space-x-3">
              <h2 className="text-3xl font-bold text-gray-800">Relatórios Gerenciais</h2>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold flex items-center border border-green-200">
                  <Lock size={12} className="mr-1"/> Desbloqueado
              </span>
          </div>
          <p className="text-gray-500 mt-1">Análise de divergências, desempenho da equipe e carregamento.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
             <button onClick={() => setIsAuthenticated(false)} className="text-sm text-gray-500 hover:text-red-600 underline mr-4">
                 Bloquear Acesso
             </button>
             <button 
                onClick={handleExportSeparators}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium shadow-sm transition-colors"
             >
                <FileDown size={18} className="text-brand-600" />
                <span>Exportar Separadores</span>
             </button>
             <button 
                onClick={handleExportDrivers}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium shadow-sm transition-colors"
             >
                <FileDown size={18} className="text-green-600" />
                <span>Exportar Motoristas</span>
             </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <div className="flex justify-between items-center">
                   <h3 className="text-gray-500 font-medium text-sm">Total Pedidos Processados</h3>
                   <Award className="text-blue-500" size={20} />
               </div>
               <p className="text-3xl font-bold text-gray-800 mt-2">{completedOrders.length}</p>
           </div>
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <div className="flex justify-between items-center">
                   <h3 className="text-gray-500 font-medium text-sm">Logística Reversa (Total)</h3>
                   <RotateCcw className="text-orange-500" size={20} />
               </div>
               <p className="text-3xl font-bold text-gray-800 mt-2">
                   {returnsChartData.reduce((acc, curr) => acc + curr.value, 0)}
               </p>
               <p className="text-xs text-orange-600 mt-1">Pedidos devolvidos</p>
           </div>
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <div className="flex justify-between items-center">
                   <h3 className="text-gray-500 font-medium text-sm">Redirecionados com Sucesso</h3>
                   <Truck className="text-green-500" size={20} />
               </div>
               <p className="text-3xl font-bold text-gray-800 mt-2">{totalRedirecionados}</p>
               <p className="text-xs text-green-600 mt-1">Re-conferidos e expedidos</p>
           </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Gráfico de Separadores (Divergências) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <Users className="mr-2 text-brand-600" size={20} />
              Divergências por Separador
            </h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Quem erra mais?</span>
          </div>
          
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={separatorChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis />
                <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    cursor={{fill: '#f1f5f9'}}
                />
                <Legend />
                <Bar dataKey="Pedidos" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Total Pedidos" />
                <Bar dataKey="Divergencias" fill="#ef4444" radius={[4, 4, 0, 0]} name="Pedidos c/ Erro" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Devoluções por Motorista */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <RotateCcw className="mr-2 text-orange-600" size={20} />
              Pedidos Retornados por Motorista
            </h3>
            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded border border-orange-200">Logística Reversa</span>
          </div>

          <div className="h-80 flex items-center justify-center">
              {returnsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={returnsChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {returnsChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={RETURN_COLORS[index % RETURN_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend layout="vertical" verticalAlign="middle" align="right" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                  <div className="text-center text-gray-400">
                      <p>Nenhuma devolução registrada.</p>
                  </div>
              )}
          </div>
        </div>
      </div>

      {/* Tabela Detalhada de Métricas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-800">Métricas Detalhadas da Operação</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="text-xs font-semibold text-gray-500 uppercase bg-gray-50 border-b">
                        <th className="px-6 py-3">Separador</th>
                        <th className="px-6 py-3 text-center">Total Pedidos</th>
                        <th className="px-6 py-3 text-center">100% Corretos</th>
                        <th className="px-6 py-3 text-center text-red-600">Com Divergência</th>
                        <th className="px-6 py-3 text-right">Índice de Precisão</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {separatorChartData.map((stat) => {
                        const accuracy = 100 - parseFloat(stat.TaxaErro as string);
                        return (
                            <tr key={stat.name} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">{stat.name}</td>
                                <td className="px-6 py-4 text-center text-gray-600">{stat.Pedidos}</td>
                                <td className="px-6 py-4 text-center text-green-600 font-medium">{stat.Pedidos - stat.Divergencias}</td>
                                <td className="px-6 py-4 text-center text-red-600 font-bold">{stat.Divergencias}</td>
                                <td className="px-6 py-4 text-right">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        accuracy > 90 ? 'bg-green-100 text-green-800' : 
                                        accuracy > 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {accuracy > 90 && <Award size={12} className="mr-1" />}
                                        {accuracy.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
      </div>

      {/* Tabela de Diário de Logística Reversa (Nova) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-orange-100 bg-orange-50 flex justify-between items-center">
            <div className="flex items-center">
                 <RotateCcw className="text-orange-600 mr-2" size={20} />
                 <h3 className="font-bold text-gray-800">Diário de Logística Reversa</h3>
            </div>
            <span className="text-xs text-orange-700 bg-orange-100 border border-orange-200 px-2 py-1 rounded">Registro de Re-entregas</span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="text-xs font-semibold text-gray-500 uppercase bg-gray-50 border-b">
                        <th className="px-6 py-3">Data Retorno</th>
                        <th className="px-6 py-3">Pedido ID</th>
                        <th className="px-6 py-3">Motorista</th>
                        <th className="px-6 py-3">Motivo Registrado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {detailedReturnList.map((item, idx) => (
                         <tr key={idx} className="hover:bg-gray-50 transition-colors">
                             <td className="px-6 py-4 text-sm text-gray-600">{new Date(item.date).toLocaleDateString()} <span className="text-xs text-gray-400 ml-1">{new Date(item.date).toLocaleTimeString()}</span></td>
                             <td className="px-6 py-4 font-medium text-gray-900">{item.orderId}</td>
                             <td className="px-6 py-4 text-sm text-gray-800 font-medium">{item.driver}</td>
                             <td className="px-6 py-4 text-sm text-gray-600 italic">"{item.reason}"</td>
                         </tr>
                    ))}
                    {detailedReturnList.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-400">Nenhum registro de devolução encontrado.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

    </div>
  );
};

export default Reports;