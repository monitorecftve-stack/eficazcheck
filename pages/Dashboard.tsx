import React from 'react';
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
  Cell
} from 'recharts';
// Fix: Added PackageCheck to imports
import { ClipboardList, CheckCircle, AlertTriangle, TrendingUp, PackageCheck, RotateCcw } from 'lucide-react';

interface DashboardProps {
  orders: Order[];
  onNavigateToConference: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ orders, onNavigateToConference }) => {
  const totalOrders = orders.length;
  const pending = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const completed = orders.filter(o => o.status === OrderStatus.COMPLETED).length;
  const issues = orders.filter(o => o.status === OrderStatus.COMPLETED_WITH_ERRORS).length;
  const returned = orders.filter(o => o.status === OrderStatus.RETURNED).length;

  const completionRate = totalOrders > 0 ? Math.round(((completed + issues) / totalOrders) * 100) : 0;

  // Chart Data
  const statusData = [
    { name: 'Pendentes', value: pending, color: '#cbd5e1' },
    { name: 'Concluídos', value: completed, color: '#22c55e' },
    { name: 'Divergentes', value: issues, color: '#ef4444' },
    { name: 'Devolvidos', value: returned, color: '#f97316' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Painel de Controle</h2>
        <p className="text-gray-500 mt-1">Visão geral da operação de expedição hoje.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard 
          title="Total Pedidos" 
          value={totalOrders} 
          icon={<ClipboardList className="text-brand-600" />} 
          trend="+12% vs ontem"
        />
        <StatCard 
          title="Concluídos" 
          value={completed} 
          icon={<CheckCircle className="text-green-600" />} 
          color="text-green-600"
        />
        <StatCard 
          title="Divergências" 
          value={issues} 
          icon={<AlertTriangle className="text-red-600" />} 
          color="text-red-600"
          subtext="Requer atenção"
        />
        <StatCard 
          title="Re-conferência" 
          value={returned} 
          icon={<RotateCcw className="text-orange-600" />} 
          color="text-orange-600"
          subtext="Devoluções"
        />
        <StatCard 
          title="Taxa de Conclusão" 
          value={`${completionRate}%`} 
          icon={<TrendingUp className="text-blue-600" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-6">Status dos Pedidos</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity / Quick Actions */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
            <div className="flex-1 flex flex-col justify-center space-y-4">
                <button 
                    onClick={onNavigateToConference}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white py-4 px-6 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-brand-500/30"
                >
                    <PackageCheck size={24} />
                    <span>Iniciar Nova Conferência</span>
                </button>
                
                <div className="mt-6">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Pendentes Prioritários</h4>
                    <div className="space-y-3">
                        {orders.filter(o => o.status === OrderStatus.PENDING).slice(0, 3).map(order => (
                            <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md border border-gray-100">
                                <div>
                                    <span className="font-medium text-gray-800 block">{order.id}</span>
                                    <span className="text-xs text-gray-500">{order.customerName}</span>
                                </div>
                                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-full">
                                    {order.items.length} itens
                                </span>
                            </div>
                        ))}
                         {orders.filter(o => o.status === OrderStatus.PENDING).length === 0 && (
                            <p className="text-sm text-gray-400 italic">Nenhum pedido pendente.</p>
                         )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{title: string, value: string | number, icon: React.ReactNode, color?: string, trend?: string, subtext?: string}> = ({
  title, value, icon, color = "text-gray-900", trend, subtext
}) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className={`text-3xl font-bold mt-2 ${color}`}>{value}</h3>
      </div>
      <div className="p-2 bg-gray-50 rounded-lg">
        {icon}
      </div>
    </div>
    {(trend || subtext) && (
      <div className="mt-4 flex items-center text-sm">
        {trend && <span className="text-green-600 font-medium mr-2">{trend}</span>}
        {subtext && <span className="text-gray-400">{subtext}</span>}
      </div>
    )}
  </div>
);

export default Dashboard;