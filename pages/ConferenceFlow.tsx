import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus, ConferenceSession, ProductItem } from '../types';
import { analyzeDiscrepancies } from '../services/geminiService';
import { 
  ArrowLeft, 
  User, 
  Truck, 
  Clock, 
  Search, 
  ScanBarcode, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Save,
  FileDown,
  Calculator,
  X,
  Camera,
  VideoOff,
  RotateCcw,
  Eye,
  EyeOff,
  Box
} from 'lucide-react';

interface ConferenceFlowProps {
  orders: Order[];
  preSelectedOrderId: string | null;
  onUpdateOrder: (order: Order) => void;
  onBack: () => void;
}

type FlowState = 'SELECT_ORDER' | 'SETUP_SESSION' | 'SCANNING' | 'REPORT';
type ConferenceMode = 'OPEN' | 'BLIND';

const ConferenceFlow: React.FC<ConferenceFlowProps> = ({ orders, preSelectedOrderId, onUpdateOrder, onBack }) => {
  const [currentState, setCurrentState] = useState<FlowState>(preSelectedOrderId ? 'SETUP_SESSION' : 'SELECT_ORDER');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(
    preSelectedOrderId ? orders.find(o => o.id === preSelectedOrderId) || null : null
  );
  
  // Session Form State
  const [sessionForm, setSessionForm] = useState<Partial<ConferenceSession>>({
    separatorName: '',
    conferenteName: '',
    driverName: '',
    vehiclePlate: ''
  });
  
  const [conferenceMode, setConferenceMode] = useState<ConferenceMode>('OPEN');

  // Scanning State
  const [scanInput, setScanInput] = useState('');
  const [scanMessage, setScanMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Camera State
  const [showCamera, setShowCamera] = useState(false);
  const scannerRef = useRef<any>(null);

  // Quantity Modal State
  const [pendingItem, setPendingItem] = useState<ProductItem | null>(null);
  const [quantityInput, setQuantityInput] = useState<string>('');
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Report State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Focus management
  useEffect(() => {
    if (currentState === 'SCANNING' && !pendingItem && !showCamera) {
      // Give a small delay to allow modal to close completely
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
    }
    if (pendingItem) {
      setTimeout(() => {
        quantityInputRef.current?.focus();
      }, 100);
    }
  }, [currentState, pendingItem, showCamera]);

  // Camera Logic
  useEffect(() => {
    if (showCamera) {
       // Allow DOM to render #reader div
       const timer = setTimeout(() => {
           // @ts-ignore
           const html5QrCode = new window.Html5Qrcode("reader");
           scannerRef.current = html5QrCode;
           
           const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
           
           html5QrCode.start(
             { facingMode: "environment" }, 
             config, 
             (decodedText: string) => {
                // Success Callback
                stopCamera();
                processBarcode(decodedText);
             },
             (errorMessage: string) => {
                // ignore errors for each frame
             }
           ).catch((err: any) => {
              console.error(err);
              setScanMessage({ type: 'error', text: 'Não foi possível iniciar a câmera. Verifique as permissões.' });
              setShowCamera(false);
           });
       }, 200);
       return () => clearTimeout(timer);
    } else {
        // Cleanup if component unmounts or state changes while scanning
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => scannerRef.current.clear());
        }
    }
  }, [showCamera]);

  const stopCamera = () => {
      if (scannerRef.current) {
          scannerRef.current.stop().then(() => {
              scannerRef.current.clear();
              setShowCamera(false);
          }).catch(() => setShowCamera(false));
      } else {
          setShowCamera(false);
      }
  };

  const handleOrderSelect = (order: Order) => {
    setSelectedOrder(order);
    setCurrentState('SETUP_SESSION');
  };

  const startConference = () => {
    if (!sessionForm.separatorName || !sessionForm.conferenteName) {
      alert("Preencha os responsáveis.");
      return;
    }

    if (selectedOrder) {
      const updatedOrder = {
        ...selectedOrder,
        status: OrderStatus.IN_PROGRESS,
        // Reset quantities if it was a returned order to ensure full re-check
        items: selectedOrder.status === OrderStatus.RETURNED 
            ? selectedOrder.items.map(i => ({...i, quantityScanned: 0})) 
            : selectedOrder.items,
        sessionData: {
          ...sessionForm as ConferenceSession,
          startTime: new Date().toISOString(),
          mode: conferenceMode
        }
      };
      onUpdateOrder(updatedOrder);
      setSelectedOrder(updatedOrder);
      setCurrentState('SCANNING');
    }
  };

  // Logic extracted to support both Manual Input and Camera
  const processBarcode = (sku: string) => {
    if (!selectedOrder) return;
    const cleanSku = sku.trim();
    
    // Try to match exact SKU/Barcode
    const item = selectedOrder.items.find(i => i.sku === cleanSku);

    if (!item) {
      setScanMessage({ type: 'error', text: `Produto não pertence ao pedido: ${cleanSku}` });
      setScanInput('');
    } else {
      // ABRE O MODAL DE QUANTIDADE
      setPendingItem(item);
      setQuantityInput(''); // Campo inicia vazio para forçar a digitação
      setScanMessage(null);
      setScanInput(''); // Limpa o input principal
    }
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !scanInput) return;
    processBarcode(scanInput);
  };

  const confirmQuantity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !pendingItem) return;

    const qtyToAdd = parseInt(quantityInput, 10);

    if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
      alert("Por favor, insira uma quantidade válida.");
      return;
    }

    const itemIndex = selectedOrder.items.findIndex(i => i.sku === pendingItem.sku);
    if (itemIndex === -1) return;

    const currentItem = selectedOrder.items[itemIndex];
    
    // Soma a quantidade informada ao que já foi conferido anteriormente
    const newTotal = currentItem.quantityScanned + qtyToAdd;
    
    let msgType: 'success' | 'error' = 'success';
    let msgText = `Conferido: +${qtyToAdd} un de ${currentItem.name}`;

    // Validação de Sobra (Ainda mostra aviso no modo cego, pois é erro critico)
    if (newTotal > currentItem.quantityRequested) {
      msgType = 'error';
      msgText = `ALERTA DE SOBRA: Quantidade total (${newTotal}) excede o pedido (${currentItem.quantityRequested})!`;
    } else if (newTotal === currentItem.quantityRequested) {
      msgText = `Item ${currentItem.name} finalizado com sucesso!`;
    } else {
      msgText = `Parcial: ${newTotal}/${currentItem.quantityRequested} conferidos.`;
    }

    const newItems = [...selectedOrder.items];
    newItems[itemIndex] = { ...currentItem, quantityScanned: newTotal };

    const updatedOrder = { ...selectedOrder, items: newItems };
    setSelectedOrder(updatedOrder);
    onUpdateOrder(updatedOrder);
    
    setScanMessage({ type: msgType, text: msgText });
    
    // Close modal and return to scan
    setPendingItem(null);
    setQuantityInput('');
  };

  const cancelQuantity = () => {
    setPendingItem(null);
    setQuantityInput('');
    setScanInput('');
  };

  const finishConference = async () => {
    if (!selectedOrder) return;

    const hasErrors = selectedOrder.items.some(i => i.quantityScanned !== i.quantityRequested);
    const finalStatus = hasErrors ? OrderStatus.COMPLETED_WITH_ERRORS : OrderStatus.COMPLETED;

    const finishedOrder = {
      ...selectedOrder,
      status: finalStatus,
      sessionData: {
        ...selectedOrder.sessionData!,
        endTime: new Date().toISOString()
      }
    };

    // Optimistic update
    setSelectedOrder(finishedOrder);
    onUpdateOrder(finishedOrder);
    setCurrentState('REPORT');

    // Trigger AI Analysis
    setLoadingAi(true);
    const analysis = await analyzeDiscrepancies(finishedOrder);
    setAiAnalysis(analysis);
    setLoadingAi(false);
    
    // Save AI analysis to order history
    const orderWithAi = {
        ...finishedOrder,
        sessionData: { ...finishedOrder.sessionData!, geminiAnalysis: analysis }
    };
    onUpdateOrder(orderWithAi);
    setSelectedOrder(orderWithAi);
  };

  // --- SUB-COMPONENTS (Render Logic) ---

  if (currentState === 'SELECT_ORDER') {
    const availableOrders = orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.RETURNED);

    return (
      <div className="p-8 max-w-5xl mx-auto">
        <button onClick={onBack} className="mb-4 flex items-center text-gray-500 hover:text-gray-900">
          <ArrowLeft size={20} className="mr-2" /> Voltar
        </button>
        <h2 className="text-2xl font-bold mb-6">Selecione um Pedido para Conferir</h2>
        <div className="grid gap-4">
          {availableOrders.map(order => (
            <div key={order.id} className={`p-6 rounded-lg shadow-sm border flex justify-between items-center hover:border-brand-500 transition-colors cursor-pointer ${order.status === OrderStatus.RETURNED ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`} onClick={() => handleOrderSelect(order)}>
              <div>
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-lg text-gray-800">{order.id}</span>
                  {order.status === OrderStatus.RETURNED ? (
                      <span className="flex items-center text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full font-bold">
                          <RotateCcw size={12} className="mr-1"/> RE-CONFERÊNCIA
                      </span>
                  ) : (
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{order.items.length} Itens</span>
                  )}
                </div>
                <p className="text-gray-600">{order.customerName} ({order.customerCode})</p>
                {order.status === OrderStatus.RETURNED && order.returnHistory && order.returnHistory.length > 0 && (
                    <p className="text-xs text-orange-700 mt-1 font-medium">
                        Motivo Retorno: {order.returnHistory[order.returnHistory.length-1].reason}
                    </p>
                )}
              </div>
              <button className="bg-brand-600 text-white px-4 py-2 rounded-md">Selecionar</button>
            </div>
          ))}
           {availableOrders.length === 0 && (
               <p className="text-gray-500">Nenhum pedido pendente ou retornado.</p>
           )}
        </div>
      </div>
    );
  }

  if (currentState === 'SETUP_SESSION') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <button onClick={() => setCurrentState('SELECT_ORDER')} className="mb-4 flex items-center text-gray-500 hover:text-gray-900">
          <ArrowLeft size={20} className="mr-2" /> Voltar
        </button>
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold mb-2">Preparação da Conferência</h2>
          <div className="flex items-center space-x-2 mb-6">
              <p className="text-gray-500">Pedido: {selectedOrder?.id}</p>
              {selectedOrder?.status === OrderStatus.RETURNED && (
                  <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full font-bold border border-orange-200">
                      RE-CONFERÊNCIA (RETORNO)
                  </span>
              )}
          </div>
          
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
             <label className="block text-sm font-bold text-gray-700 mb-2">Modo de Operação</label>
             <div className="flex space-x-4">
                 <button 
                    onClick={() => setConferenceMode('OPEN')}
                    className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center space-x-2 border transition-colors ${conferenceMode === 'OPEN' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300'}`}
                 >
                     <Eye size={18} />
                     <span>Conferência Aberta</span>
                 </button>
                 <button 
                    onClick={() => setConferenceMode('BLIND')}
                    className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center space-x-2 border transition-colors ${conferenceMode === 'BLIND' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300'}`}
                 >
                     <EyeOff size={18} />
                     <span>Conferência Cega</span>
                 </button>
             </div>
             <p className="text-xs text-gray-500 mt-2">
                 {conferenceMode === 'OPEN' ? 'O operador visualiza as quantidades solicitadas.' : 'O operador NÃO visualiza quantidades solicitadas (Blind Count).'}
             </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Separador</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="Nome do separador"
                      value={sessionForm.separatorName}
                      onChange={e => setSessionForm({...sessionForm, separatorName: e.target.value})}
                    />
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conferente</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="Seu nome"
                      value={sessionForm.conferenteName}
                      onChange={e => setSessionForm({...sessionForm, conferenteName: e.target.value})}
                    />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motorista (Opcional)</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="Nome do motorista"
                      value={sessionForm.driverName}
                      onChange={e => setSessionForm({...sessionForm, driverName: e.target.value})}
                    />
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placa (Opcional)</label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="ABC-1234"
                      value={sessionForm.vehiclePlate}
                      onChange={e => setSessionForm({...sessionForm, vehiclePlate: e.target.value})}
                    />
                  </div>
               </div>
            </div>
          </div>

          <div className="mt-8">
            <button 
              onClick={startConference}
              className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold hover:bg-brand-700 transition-colors"
            >
              Iniciar Conferência
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentState === 'SCANNING' && selectedOrder) {
    const isBlind = selectedOrder.sessionData?.mode === 'BLIND';
    const totalRequested = selectedOrder.items.reduce((acc, i) => acc + i.quantityRequested, 0);
    const totalScanned = selectedOrder.items.reduce((acc, i) => acc + i.quantityScanned, 0);
    const progress = totalRequested > 0 ? Math.round((totalScanned / totalRequested) * 100) : 0;

    return (
      <div className="h-full flex flex-col bg-gray-100 relative">
        {/* Quantity Modal */}
        {pendingItem && (
          <div className="absolute inset-0 bg-dark-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 transform transition-all">
              <div className="bg-brand-600 p-4 text-white flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center">
                  <Calculator className="mr-2" /> Confronto de Quantidade
                </h3>
                <button onClick={cancelQuantity} className="hover:bg-brand-700 rounded-full p-1">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={confirmQuantity} className="p-6">
                {/* Context Info Inside Modal */}
                <div className="mb-4 text-center border-b border-gray-100 pb-4">
                    <span className="text-xs text-gray-400 uppercase font-bold">Conferindo Pedido</span>
                    <p className="text-sm font-bold text-gray-600 flex justify-center items-center mt-1">
                        <Box size={14} className="mr-1"/> {selectedOrder.id} 
                        <span className="mx-2 text-gray-300">|</span>
                        <User size={14} className="mr-1"/> {selectedOrder.customerName}
                    </p>
                </div>

                <div className="mb-6 text-center">
                  <p className="text-sm text-gray-500 mb-1 uppercase tracking-wide">Produto Identificado</p>
                  <p className="text-xl font-bold text-gray-900 leading-tight">{pendingItem.name}</p>
                  <p className="text-sm font-mono text-gray-400 mt-1">{pendingItem.sku}</p>
                </div>

                {!isBlind && (
                    <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-3 rounded-lg">
                        <div className="text-center border-r border-gray-200">
                            <span className="block text-xs text-gray-500 uppercase">Pedido</span>
                            <span className="block text-lg font-bold text-gray-800">{pendingItem.quantityRequested}</span>
                        </div>
                        <div className="text-center">
                            <span className="block text-xs text-gray-500 uppercase">Já Contado</span>
                            <span className="block text-lg font-bold text-brand-600">{pendingItem.quantityScanned}</span>
                        </div>
                    </div>
                )}
                {isBlind && (
                    <div className="mb-6 p-3 bg-purple-50 rounded-lg text-center border border-purple-100">
                        <p className="text-purple-800 font-bold text-sm flex items-center justify-center">
                            <EyeOff size={16} className="mr-2"/> Modo Cego Ativo
                        </p>
                        <p className="text-xs text-purple-600 mt-1">Informe a quantidade física real.</p>
                    </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2 text-center">Quantidade Física (Separação Atual):</label>
                  <input
                    ref={quantityInputRef}
                    type="number"
                    min="1"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    className="w-full text-center text-5xl font-bold py-6 border-2 border-brand-300 rounded-xl focus:border-brand-600 focus:ring-4 focus:ring-brand-100 outline-none text-brand-700 placeholder-gray-300"
                    placeholder="0"
                    autoFocus
                  />
                  <p className="text-xs text-center text-gray-400 mt-2">Digite a quantidade que você separou agora.</p>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all"
                >
                  Confirmar Lançamento
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Header Info with prominent Order Context */}
        <div className="bg-white p-4 border-b shadow-sm flex justify-between items-center">
          <div>
             <div className="flex items-center space-x-2 mb-1">
                 <span className="bg-gray-800 text-white text-xs font-bold px-2 py-0.5 rounded">{selectedOrder.id}</span>
                 {isBlind && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-bold">MODO CEGO</span>}
             </div>
             <h2 className="font-bold text-xl text-gray-900 flex items-center leading-none">
                {selectedOrder.customerName}
             </h2>
             <div className="flex items-center text-sm text-gray-500 space-x-4 mt-2">
               <span className="flex items-center"><User size={14} className="mr-1"/> {selectedOrder.sessionData?.conferenteName}</span>
            </div>
          </div>
          <div className="text-right">
            {!isBlind ? (
                <>
                    <div className="text-3xl font-bold text-brand-600">{progress}%</div>
                    <div className="text-xs text-gray-400 uppercase font-semibold">Concluído</div>
                </>
            ) : (
                <div className="text-purple-600 font-bold flex flex-col items-end opacity-70">
                    <EyeOff size={24} />
                    <span className="text-xs mt-1">Qtd Oculta</span>
                </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Scan Input Area */}
          <div className="md:w-1/3 bg-gray-50 p-6 border-r border-gray-200 flex flex-col z-10">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase">Código de Barras / SKU</label>
                
                {showCamera ? (
                  <div className="mb-4 animate-in fade-in zoom-in duration-300">
                     <div id="reader" className="w-full rounded-lg overflow-hidden bg-black min-h-[250px] border-2 border-brand-500 relative"></div>
                     <button onClick={stopCamera} className="mt-2 w-full flex items-center justify-center space-x-2 text-red-600 bg-red-50 hover:bg-red-100 py-3 rounded-lg font-medium transition-colors">
                        <VideoOff size={18} />
                        <span>Cancelar Câmera</span>
                     </button>
                  </div>
                ) : (
                  <>
                    <form onSubmit={handleScan} className="relative mb-3">
                      <ScanBarcode className="absolute left-3 top-3.5 text-gray-400" />
                      <input 
                        ref={scanInputRef}
                        type="text" 
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border-2 border-brand-200 rounded-lg focus:border-brand-500 focus:ring-0 text-lg font-mono"
                        placeholder="Escanear item..."
                        autoComplete="off"
                        disabled={!!pendingItem}
                      />
                      <button type="submit" className="hidden">Scan</button>
                    </form>
                    
                    <button 
                      onClick={() => setShowCamera(true)} 
                      className="w-full flex items-center justify-center space-x-2 bg-blue-50 text-brand-700 py-3 rounded-lg font-medium hover:bg-blue-100 transition-colors border border-blue-200 mb-2"
                    >
                       <Camera size={20} />
                       <span>Ler com Câmera</span>
                    </button>
                  </>
                )}
                
                {scanMessage && (
                  <div className={`mt-4 p-3 rounded-lg flex items-center ${scanMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {scanMessage.type === 'success' ? <CheckCircle2 size={20} className="mr-2" /> : <AlertTriangle size={20} className="mr-2" />}
                    <span className="font-medium">{scanMessage.text}</span>
                  </div>
                )}
             </div>

             <div className="mt-auto">
               <button 
                 onClick={finishConference}
                 className="w-full bg-dark-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-dark-800 transition-all flex justify-center items-center space-x-2"
               >
                 <Save size={20} />
                 <span>Finalizar Conferência</span>
               </button>
             </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 gap-3">
              {selectedOrder.items.map((item) => {
                // Logic for Blind Mode: Hide status colors and numbers
                const isComplete = item.quantityScanned === item.quantityRequested;
                const isOver = item.quantityScanned > item.quantityRequested;
                const inProgress = item.quantityScanned > 0 && item.quantityScanned < item.quantityRequested;
                
                let borderClass = 'border-gray-200';
                let bgClass = 'bg-white';
                
                if (!isBlind) {
                    if (isComplete) { borderClass = 'border-green-200'; bgClass = 'bg-green-50'; }
                    else if (isOver) { borderClass = 'border-red-200'; bgClass = 'bg-red-50'; }
                    else if (inProgress) { borderClass = 'border-blue-200'; bgClass = 'bg-blue-50'; }
                } else {
                    // In blind mode, give a subtle indication if item has been touched, but not result
                    if (item.quantityScanned > 0) {
                        bgClass = 'bg-gray-50';
                        borderClass = 'border-gray-300';
                    }
                }

                return (
                  <div key={item.sku} className={`p-4 rounded-lg border flex justify-between items-center transition-colors ${borderClass} ${bgClass}`}>
                    <div className="flex items-center space-x-4">
                      {!isBlind ? (
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${
                            isComplete ? 'bg-green-500 text-white' : isOver ? 'bg-red-500 text-white' : 'bg-white border border-gray-200 text-gray-500'
                          }`}>
                            {item.quantityScanned}
                          </div>
                      ) : (
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.quantityScanned > 0 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                              {item.quantityScanned > 0 ? <CheckCircle2 size={20} /> : <EyeOff size={20}/>}
                          </div>
                      )}
                      
                      <div>
                        <h4 className="font-bold text-gray-800 text-lg">{item.name}</h4>
                        <p className="text-sm font-mono text-gray-500">SKU: {item.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {!isBlind ? (
                          <>
                            <span className="text-xs text-gray-500 uppercase">Solicitado</span>
                            <p className="font-bold text-xl text-gray-800">{item.quantityRequested}</p>
                          </>
                      ) : (
                          <span className="text-xs text-gray-400 italic">
                              {item.quantityScanned > 0 ? 'Item Conferido' : 'Pendente'}
                          </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentState === 'REPORT' && selectedOrder) {
    const isClean = selectedOrder.items.every(i => i.quantityScanned === i.quantityRequested);

    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className={`p-6 ${isClean ? 'bg-green-600' : 'bg-red-600'} text-white`}>
            <h2 className="text-3xl font-bold flex items-center">
              {isClean ? <CheckCircle2 size={32} className="mr-3" /> : <AlertTriangle size={32} className="mr-3" />}
              {isClean ? 'Conferência Aprovada' : 'Divergências Encontradas'}
            </h2>
            <p className="opacity-90 mt-1">Pedido {selectedOrder.id} finalizado em {new Date().toLocaleTimeString()}</p>
          </div>

          <div className="p-8">
            {/* Gemini Analysis Section */}
            <div className="mb-8 bg-brand-50 border border-brand-200 rounded-xl p-6">
                <h3 className="text-lg font-bold text-brand-800 mb-3 flex items-center">
                    <Search size={20} className="mr-2" />
                    Análise Inteligente (IA)
                </h3>
                {loadingAi ? (
                    <div className="animate-pulse flex space-x-4">
                        <div className="flex-1 space-y-4 py-1">
                            <div className="h-4 bg-brand-200 rounded w-3/4"></div>
                            <div className="h-4 bg-brand-200 rounded"></div>
                            <div className="h-4 bg-brand-200 rounded w-5/6"></div>
                        </div>
                    </div>
                ) : (
                    <div className="prose prose-sm text-brand-900 whitespace-pre-line">
                        {aiAnalysis}
                    </div>
                )}
            </div>

            <h3 className="font-bold text-gray-800 mb-4 text-lg">Detalhes dos Itens</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm">
                  <th className="py-3">Produto</th>
                  <th className="py-3 text-center">Solicitado</th>
                  <th className="py-3 text-center">Conferido</th>
                  <th className="py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items.map(item => {
                    const diff = item.quantityScanned - item.quantityRequested;
                    let statusColor = 'text-green-600';
                    let statusText = 'OK';
                    if (diff < 0) { statusColor = 'text-red-600'; statusText = `Falta ${Math.abs(diff)}`; }
                    if (diff > 0) { statusColor = 'text-orange-600'; statusText = `Sobra ${diff}`; }

                    return (
                        <tr key={item.sku} className="border-b border-gray-100">
                            <td className="py-3 font-medium text-gray-800">{item.name} <span className="block text-xs text-gray-400 font-mono">{item.sku}</span></td>
                            <td className="py-3 text-center">{item.quantityRequested}</td>
                            <td className="py-3 text-center">{item.quantityScanned}</td>
                            <td className={`py-3 text-right font-bold ${statusColor}`}>{statusText}</td>
                        </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-end space-x-3">
             <button 
                onClick={() => alert('Funcionalidade de PDF seria gerada aqui.')}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
            >
                <FileDown size={18} />
                <span>Baixar PDF</span>
             </button>
             <button 
                onClick={onBack}
                className="px-6 py-2 bg-dark-900 text-white rounded-lg hover:bg-dark-800 font-medium"
            >
                Voltar ao Painel
             </button>
          </div>
        </div>
      </div>
    );
  }

  return <div>Carregando...</div>;
};

export default ConferenceFlow;