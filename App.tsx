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
  ArrowLeft,
  Image as ImageIcon
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import ImportOrders from './pages/ImportOrders';
import ConferenceFlow from './pages/ConferenceFlow';
import HistoryLog from './pages/HistoryLog';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import ImageEditor from './pages/ImageEditor';
import Login from './pages/Login';
import { Order, OrderStatus, ProductItem, CorrectionLog, ReturnEvent, User } from './types';
import { initDB, getAllOrders, saveOrder, saveAllOrders } from './services/storageService';
import { getCurrentUser, logout } from './services/authService';

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
        conferenteName: 'Carlos Silva',
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
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // App State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'import' | 'conference' | 'history' | 'reports' | 'settings' | 'image-editor'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  // Mobile Navigation State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Network & Storage State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  // Initial Auth Check
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
        setCurrentUser(user);
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
  };

  const fetchOrders = useCallback(async () => {
    try {
        const storedOrders = await getAllOrders();
        if (storedOrders.length > 0) {
            setOrders(storedOrders);
        } else if (!dbReady) {
            setOrders(INITIAL_ORDERS_FALLBACK);
            await saveAllOrders(INITIAL_ORDERS_FALLBACK);
        } else {
            setOrders([]);
        }
    } catch (err) {
        console.error("Failed to fetch orders", err);
    }
  }, [dbReady]);

  // Initialize DB and Network Listeners
  useEffect(() => {
    if (!currentUser) return; // Don't init DB until logged in (optimization)

    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    const setupDatabase = async () => {
        try {
            await initDB();
            setDbReady(true);
            const storedOrders = await getAllOrders();
            if (storedOrders.length > 0) {
                setOrders(storedOrders);
            } else {
                setOrders(INITIAL_ORDERS_FALLBACK);
                await saveAllOrders(INITIAL_ORDERS_FALLBACK);
            }
        } catch (err) {
            console.error("Failed to initialize database", err);
            setOrders(INITIAL_ORDERS_FALLBACK);
        }
    };

    setupDatabase();

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, [currentUser]);

  // Sync effect (Simulation)
  useEffect(() => {
      if (isOnline && dbReady && currentUser) {
          setIsSyncing(true);
          const timer = setTimeout(() => setIsSyncing(false), 2000);
          return () => clearTimeout(timer);
      }
  }, [isOnline, orders, dbReady, currentUser]);

  // --- CRUD Operations with Persistence ---

  const updateOrder = async (updatedOrder: Order) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    try {
        await saveOrder(updatedOrder);
    } catch (e) {
        console.error("Failed to save order offline", e);
    }
  };

  const addOrders = async (newOrders: Order[]) => {
    setOrders(prev => [...prev, ...newOrders]);
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
                  registeredBy: currentUser?.name || 'Sistema'
              };
              updatedOrder = {
                  ...order,
                  status: OrderStatus.RETURNED,
                  returnHistory: [...(order.returnHistory || []), returnEvent]
              };
              return updatedOrder;
          });
      });
      if (updatedOrder) {
          try { await saveOrder(updatedOrder); } catch (e) {}
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

  // --- Render Logic ---

  if (!currentUser) {
      return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (!dbReady) {
      return (
          <div className="flex h-screen items-center justify-center bg-gray-100 flex-col">
              <RefreshCw className="animate-spin text-brand-600 mb-4" size={40} />
              <p className="text-gray-600">Inicializando sistema...</p>
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
            <h1 className="text-lg font-bold tracking-tight">Confere Eficaz</h1>
            <p className="text-xs text-gray-400">Logística Inteligente</p>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-800">
             <div className="flex items-center space-x-3">
                 <div className="bg-gray-700 rounded-full p-2">
                     <div className="font-bold text-sm text-white">{currentUser.name.charAt(0)}</div>
                 </div>
                 <div className="overflow-hidden">
                     <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
                     <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 flex items-center mt-0.5">
                         <LogOut size={10} className="mr-1" /> Sair
                     </button>
                 </div>
             </div>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={<BarChart3 size={20} />} label="Relatórios" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          <SidebarItem icon={<FileInput size={20} />} label="Importar Pedidos" active={activeTab === 'import'} onClick={() => setActiveTab('import')} />
          <SidebarItem icon={<PackageCheck size={20} />} label="Conferência" active={activeTab === 'conference'} onClick={() => setActiveTab('conference')} />
          <SidebarItem icon={<History size={20} />} label="Histórico" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <div className="pt-4 mt-2 border-t border-gray-800/50">
             <SidebarItem icon={<ImageIcon size={20} />} label="Editor IA" active={activeTab === 'image-editor'} onClick={() => setActiveTab('image-editor')} />
          </div>
        </nav>

        <div className="px-4 pb-4">
             <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium ${isOnline ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                 {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                 <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
             </div>
        </div>

        <div className="p-4 border-t border-gray-800">
          <button onClick={() => setActiveTab('settings')} className={`flex items-center space-x-3 w-full transition-colors p-2 rounded-md ${activeTab === 'settings' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            <Settings size={20} /><span>Configurações</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden absolute top-0 left-0 w-full bg-dark-900 text-white h-16 flex justify-between items-center px-4 z-20 shadow-md">
         {activeTab === 'dashboard' ? (
             <div className="flex items-center space-x-2">
                 <PackageCheck className="text-brand-500" size={24} />
                 <span className="font-bold text-lg">Confere Eficaz</span>
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
              <div className="flex justify-between items-center p-4 border-b border-gray-800">
                  <span className="font-bold text-lg text-gray-300">Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-gray-800 rounded-full">
                      <LogOut size={20} />
                  </button>
              </div>
              <div className="p-6 bg-gray-800 mb-2">
                   <p className="text-gray-400 text-xs uppercase">Logado como</p>
                   <p className="font-bold text-xl text-white">{currentUser.name}</p>
                   <button onClick={handleLogout} className="mt-2 text-sm text-red-400 font-medium border border-red-900/50 bg-red-900/20 px-3 py-1 rounded">Sair da Conta</button>
              </div>
              <div className="flex-1 flex flex-col space-y-2 p-4">
                  <button onClick={() => navigateTo('dashboard')} className="text-lg font-medium w-full text-left py-4 border-b border-gray-800">Dashboard</button>
                  <button onClick={() => navigateTo('conference')} className="text-lg font-medium w-full text-left py-4 border-b border-gray-800">Conferência</button>
                  <button onClick={() => navigateTo('import')} className="text-lg font-medium w-full text-left py-4 border-b border-gray-800">Importar Pedidos</button>
                  <button onClick={() => navigateTo('history')} className="text-lg font-medium w-full text-left py-4 border-b border-gray-800">Histórico</button>
                  <button onClick={() => navigateTo('reports')} className="text-lg font-medium w-full text-left py-4 border-b border-gray-800">Relatórios</button>
                  <button onClick={() => navigateTo('image-editor')} className="text-lg font-medium w-full text-left py-4 border-b border-gray-800">Editor IA</button>
                  <button onClick={() => navigateTo('settings')} className="text-lg font-medium w-full text-left py-4 text-gray-400">Configurações</button>
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
            currentUser={currentUser}
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
            onReopenConference={handleStartConference}
          />
        )}
        {activeTab === 'image-editor' && (
            <ImageEditor />
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