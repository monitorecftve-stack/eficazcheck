import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  PackageCheck, 
  FileInput, 
  History, 
  Settings, 
  Menu,
  LogOut,
  BarChart3,
  Wifi,
  WifiOff,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import ImportOrders from './pages/ImportOrders';
import ConferenceFlow from './pages/ConferenceFlow';
import HistoryLog from './pages/HistoryLog';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import { Order, OrderStatus, ProductItem, CorrectionLog, ReturnEvent } from './types';
import { initDB, getAllOrders, saveOrder, saveAllOrders } from './services/storageService';

// Mock Data Initialization (Fallback only)
const INITIAL_ORDERS_FALLBACK: Order[] = [
  {
    id: 'PED-1001',
    customerCode: 'C-505',
    customerName: 'Supermercados Silva',
    status: OrderStatus.PENDING,
    createdAt: new Date().toISOString(),
    items: [
      { sku: '78910001', name: 'Coca-Cola 2L', quantityRequested: 12, quantityScanned: 0 },
      { sku: '78910002', name: 'Arroz Tio João 5kg', quantityRequested: 5, quantityScanned: 0 },
      { sku: '78910003', name: 'Feijão Carioca 1kg', quantityRequested: 10, quantityScanned: 0 },
    ]
  },
  {
    id: 'PED-1002',
    customerCode: 'C-882',
    customerName: 'Padaria Estrela',
    status: OrderStatus.COMPLETED,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    sessionData: {
        separatorName: 'João Silva',
        conferenteName: 'Maria Oliveira',
        driverName: 'Carlos Souza',
        vehiclePlate: 'ABC-1234',
        startTime: new Date(Date.now() - 87000000).toISOString(),
        endTime: new Date(Date.now() - 86400000).toISOString(),
        geminiAnalysis: 'Conferência realizada com sucesso. Todos os itens validados corretamente.'
    },
    items: [
      { sku: '78920001', name: 'Farinha de Trigo', quantityRequested: 20, quantityScanned: 20 },
      { sku: '78920002', name: 'Fermento Biológico', quantityRequested: 5, quantityScanned: 5 },
    ]
  }
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'import' | 'conference' | 'history' | 'reports' | 'settings'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  // Mobile Navigation State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Network & Storage State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
        const storedOrders = await getAllOrders();
        if (storedOrders.length > 0) {
            setOrders(storedOrders);
        } else if (!dbReady) {
            // Seed initial data if DB is empty only on first load
            setOrders(INITIAL_ORDERS_FALLBACK);
            await saveAllOrders(INITIAL_ORDERS_FALLBACK);
        } else {
            // DB is ready but empty (e.g. after clear), set empty array
            setOrders([]);
        }
    } catch (err) {
        console.error("Failed to fetch orders", err);
    }
  }, [dbReady]);

  // Initialize DB and Network Listeners
  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    const setupDatabase = async () => {
        try {
            await initDB();
            setDbReady(true);
            // Fetch initial orders
            const storedOrders = await getAllOrders();
            if (storedOrders.length > 0) {
                setOrders(storedOrders);
            } else {
                setOrders(INITIAL_ORDERS_FALLBACK);
                await saveAllOrders(INITIAL_ORDERS_FALLBACK);
            }
        } catch (err) {
            console.error("Failed to initialize database", err);
            // Fallback to memory
            setOrders(INITIAL_ORDERS_FALLBACK);
        }
    };

    setupDatabase();

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Sync effect (Simulation)
  useEffect(() => {
      if (isOnline && dbReady) {
          // Simulate background sync to "Server"
          setIsSyncing(true);
          const timer = setTimeout(() => setIsSyncing(false), 2000);
          return () => clearTimeout(timer);
      }
  }, [isOnline, orders, dbReady]);

  // --- CRUD Operations with Persistence ---

  const updateOrder = async (updatedOrder: Order) => {
    // 1. Update React State
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    
    // 2. Update Local DB
    try {
        await saveOrder(updatedOrder);
    } catch (e) {
        console.error("Failed to save order offline", e);
    }
  };

  const addOrders = async (newOrders: Order[]) => {
    // 1. Update React State
    setOrders(prev => [...prev, ...newOrders]);
    
    // 2. Update Local DB
    try {
        await saveAllOrders(newOrders);
    } catch (e) {
        console.error("Failed to save new orders offline", e);
    }
    
    setActiveTab('dashboard');
  };

  const handleStartConference = (orderId: string) => {
    setSelectedOrderId(orderId);
    setActiveTab('conference');
  };

  const handleCorrection = async (orderId: string, itemId: string, newQuantity: number, reason: string, user: string) => {
      let updatedOrder: Order | null = null;

      setOrders(prevOrders => {
          return prevOrders.map(order => {
              if (order.id !== orderId) return order;

              // Find item and create log
              const itemIndex = order.items.findIndex(i => i.sku === itemId);
              if (itemIndex === -1) return order;

              const oldQuantity = order.items[itemIndex].quantityScanned;
              
              const logEntry: CorrectionLog = {
                  date: new Date().toISOString(),
                  user: user,
                  sku: itemId,
                  oldQuantity: oldQuantity,
                  newQuantity: newQuantity,
                  reason: reason
              };

              const newItems = [...order.items];
              newItems[itemIndex] = { ...newItems[itemIndex], quantityScanned: newQuantity };

              const allCorrect = newItems.every(i => i.quantityScanned === i.quantityRequested);
              const newStatus = allCorrect ? OrderStatus.COMPLETED : OrderStatus.COMPLETED_WITH_ERRORS;

              updatedOrder = {
                  ...order,
                  items: newItems,
                  status: newStatus,
                  correctionHistory: [...(order.correctionHistory || []), logEntry]
              };

              return updatedOrder;
          });
      });

      // Persist the specific updated order
      if (updatedOrder) {
          try {
              await saveOrder(updatedOrder);
          } catch (e) {
              console.error("Failed to save correction offline", e);
          }
      }
  };

  const handleOrderReturn = async (orderId: string, reason: string, driverName: string) => {
      let updatedOrder: Order | null = null;

      setOrders(prevOrders => {
          return prevOrders.map(order => {
              if (order.id !== orderId) return order;

              const returnEvent: ReturnEvent = {
                  date: new Date().toISOString(),
                  reason: reason,
                  driverName: driverName,
                  registeredBy: 'Sistema'
              };

              updatedOrder = {
                  ...order,
                  status: OrderStatus.RETURNED, // Mark as Returned so it shows up in Conference again
                  returnHistory: [...(order.returnHistory || []), returnEvent]
              };

              return updatedOrder;
          });
      });

      if (updatedOrder) {
          try {
              await saveOrder(updatedOrder);
          } catch (e) {
              console.error("Failed to save return status", e);
          }
      }
  };

  // --- Mobile Navigation Handlers ---
  const navigateTo = (tab: typeof activeTab) => {
      setActiveTab(tab);
      setMobileMenuOpen(false);
  };

  const goBackToDashboard = () => {
      setActiveTab('dashboard');
      setSelectedOrderId(null);
  };

  if (!dbReady) {
      return (
          <div className="flex h-screen items-center justify-center bg-gray-100 flex-col">
              <RefreshCw className="animate-spin text-brand-600 mb-4" size={40} />
              <p className="text-gray-600">Carregando banco de dados local...</p>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-dark-900 text-white flex flex-col hidden md:flex shadow-xl z-10 transition-all">
        <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
          <div className="bg-brand-500 p-2 rounded-lg">
            <PackageCheck size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">ConfereX</h1>
            <p className="text-xs text-gray-400">Logística Inteligente</p>
          </div>
        </div>

        <nav className="flex-1 py-6 space-y-1 px-3">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={<BarChart3 size={20} />} 
            label="Relatórios" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')} 
          />
          <SidebarItem 
            icon={<FileInput size={20} />} 
            label="Importar Pedidos" 
            active={activeTab === 'import'} 
            onClick={() => setActiveTab('import')} 
          />
          <SidebarItem 
            icon={<PackageCheck size={20} />} 
            label="Conferência" 
            active={activeTab === 'conference'} 
            onClick={() => setActiveTab('conference')} 
          />
          <SidebarItem 
            icon={<History size={20} />} 
            label="Histórico" 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')} 
          />
        </nav>

        {/* System Status in Sidebar */}
        <div className="px-4 pb-4">
             <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium ${isOnline ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                 {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                 <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
             </div>
        </div>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-3 w-full transition-colors p-2 rounded-md ${activeTab === 'settings' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Settings size={20} />
            <span>Configurações</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden absolute top-0 left-0 w-full bg-dark-900 text-white h-16 flex justify-between items-center px-4 z-20 shadow-md">
         {activeTab === 'dashboard' ? (
             <div className="flex items-center space-x-2">
                 <PackageCheck className="text-brand-500" size={24} />
                 <span className="font-bold text-lg">ConfereX</span>
             </div>
         ) : (
             <button onClick={goBackToDashboard} className="flex items-center space-x-1 text-gray-300 hover:text-white">
                 <ArrowLeft size={20} />
                 <span className="text-sm font-medium">Voltar ao Início</span>
             </button>
         )}
         
         <div className="flex items-center space-x-3">
             <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} ring-2 ring-dark-800`}></div>
             {activeTab === 'dashboard' && (
                 <button onClick={() => setMobileMenuOpen(true)} className="p-1">
                    <Menu size={24} />
                 </button>
             )}
         </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-dark-900 text-white flex flex-col animate-in fade-in duration-200">
              <div className="flex justify-end p-4">
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-gray-800 rounded-full">
                      <LogOut size={20} />
                  </button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 p-8">
                  <h2 className="text-2xl font-bold mb-8 text-brand-500">Menu Principal</h2>
                  <button onClick={() => navigateTo('dashboard')} className="text-xl font-medium w-full text-center py-4 border-b border-gray-800">Dashboard</button>
                  <button onClick={() => navigateTo('conference')} className="text-xl font-medium w-full text-center py-4 border-b border-gray-800">Conferência</button>
                  <button onClick={() => navigateTo('import')} className="text-xl font-medium w-full text-center py-4 border-b border-gray-800">Importar Pedidos</button>
                  <button onClick={() => navigateTo('history')} className="text-xl font-medium w-full text-center py-4 border-b border-gray-800">Histórico</button>
                  <button onClick={() => navigateTo('reports')} className="text-xl font-medium w-full text-center py-4 border-b border-gray-800">Relatórios</button>
                  <button onClick={() => navigateTo('settings')} className="text-xl font-medium w-full text-center py-4 text-gray-400">Configurações</button>
              </div>
          </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative pt-16 md:pt-0">
        {activeTab === 'dashboard' && (
          <Dashboard 
            orders={orders} 
            onNavigateToConference={() => setActiveTab('conference')}
          />
        )}
        {activeTab === 'reports' && (
          <Reports orders={orders} />
        )}
        {activeTab === 'import' && (
          <ImportOrders onImport={addOrders} />
        )}
        {activeTab === 'conference' && (
          <ConferenceFlow 
            orders={orders} 
            preSelectedOrderId={selectedOrderId}
            onUpdateOrder={updateOrder}
            onBack={() => {
              setSelectedOrderId(null);
              setActiveTab('dashboard');
            }}
          />
        )}
        {activeTab === 'history' && (
          <HistoryLog 
            orders={orders} 
            onCorrectOrder={handleCorrection}
            onReturnOrder={handleOrderReturn}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPage 
            onRefreshData={fetchOrders}
          />
        )}
      </main>
    </div>
  );
};

const SidebarItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active 
        ? 'bg-brand-600 text-white shadow-md' 
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

export default App;