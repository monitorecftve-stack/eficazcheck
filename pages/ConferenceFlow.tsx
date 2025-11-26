import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus, ConferenceSession, ProductItem, User } from '../types';
import { analyzeDiscrepancies } from '../services/geminiService';
import { getSeparators, addSeparator } from '../services/authService';
import { 
  ArrowLeft, 
  User as UserIcon, 
  Truck, 
  Search, 
  ScanBarcode, 
  CheckCircle2, 
  AlertTriangle, 
  Save,
  FileDown,
  Calculator,
  X,
  Camera,
  VideoOff,
  RotateCcw,
  Eye,
  EyeOff,
  Box,
  Tags,
  Split,
  UserCheck
} from 'lucide-react';

interface ConferenceFlowProps {
  orders: Order[];
  preSelectedOrderId: string | null;
  currentUser: User;
  onUpdateOrder: (order: Order) => void;
  onBack: () => void;
}

type FlowState = 'SELECT_ORDER' | 'SETUP_SESSION' | 'SCANNING' | 'REPORT';
type ConferenceMode = 'OPEN' | 'BLIND';

const ConferenceFlow: React.FC<ConferenceFlowProps> = ({ orders, preSelectedOrderId, currentUser, onUpdateOrder, onBack }) => {
  const [currentState, setCurrentState] = useState<FlowState>(preSelectedOrderId ? 'SETUP_SESSION' : 'SELECT_ORDER');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(
    preSelectedOrderId ? orders.find(o => o.id === preSelectedOrderId) || null : null
  );
  
  // Separator List for Autocomplete
  const [availableSeparators, setAvailableSeparators] = useState<string[]>([]);

  // Session Form State
  const [sessionForm, setSessionForm] = useState<Partial<ConferenceSession>>({
    separatorName: '',
    conferenteName: currentUser.name, // Pre-fill with logged user
    driverName: '',
    vehiclePlate: ''
  });
  
  const [conferenceMode, setConferenceMode] = useState<ConferenceMode>('OPEN');

  // Scanning State
  const [scanInput, setScanInput] = useState('');
  const [scanMessage, setScanMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Variant Selection State (Ambiguous Scans)
  const [variantCandidates, setVariantCandidates] = useState<ProductItem[]>([]);

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

  // Initial Load
  useEffect(() => {
      setAvailableSeparators(getSeparators());
  }, []);

  // Update session form if user changes (rare but good practice)
  useEffect(() => {
      setSessionForm(prev => ({ ...prev, conferenteName: currentUser.name }));
  }, [currentUser]);

  // Focus management
  useEffect(() => {
    if (currentState === 'SCANNING' && !pendingItem && variantCandidates.length === 0 && !showCamera) {
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
    }
    if (pendingItem) {
      setTimeout(() => {
        quantityInputRef.current?.focus();
      }, 100);
    }
  }, [currentState, pendingItem, variantCandidates, showCamera]);

  // Camera Logic
  useEffect(() => {
    if (showCamera) {
       const timer = setTimeout(() => {
           // @ts-ignore
           const html5QrCode = new window.Html5Qrcode("reader");
           scannerRef.current = html5QrCode;
           const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
           html5QrCode.start(
             { facingMode: "environment" }, 
             config, 
             (decodedText: string) => {
                stopCamera();
                processBarcode(decodedText);
             },
             (errorMessage: string) => {}
           ).catch((err: any) => {
              console.error(err);
              setScanMessage({ type: 'error', text: 'Não foi possível iniciar a câmera.' });
              setShowCamera(false);
           });
       }, 200);
       return () => clearTimeout(timer);
    } else {
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

    // Save new separator to history
    addSeparator(sessionForm.separatorName);

    if (selectedOrder) {
      const updatedOrder = {
        ...selectedOrder,
        status: OrderStatus.IN_PROGRESS,
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

  const processBarcode = (sku: string) => {
    if (!selectedOrder) return;
    const cleanSku = sku.trim();
    const potentialMatches = selectedOrder.items.filter(i => i.sku === cleanSku);

    if (potentialMatches.length === 0) {
      setScanMessage({ type: 'error', text: `Produto não pertence ao pedido: ${cleanSku}` });
      setScanInput('');
    } else if (potentialMatches.length === 1) {
      openQuantityModal(potentialMatches[0]);
    } else {
      setVariantCandidates(potentialMatches);
      setScanInput('');
      setScanMessage({ type: 'error', text: 'Múltiplos itens encontrados. Selecione a variante.' });
    }
  };

  const openQuantityModal = (item: ProductItem) => {
      setPendingItem(item);
      setQuantityInput('');
      setScanMessage(null);
      setScanInput('');
      setVariantCandidates([]);
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

    const itemIndex = selectedOrder.items.findIndex(i => 
        i.sku === pendingItem.sku && i.variant === pendingItem.variant
    );

    if (itemIndex === -1) return;
    const currentItem = selectedOrder.items[itemIndex];
    const newTotal = currentItem.quantityScanned + qtyToAdd;
    
    let msgType: 'success' | 'error' = 'success';
    let msgText = `Conferido: +${qtyToAdd} un de ${currentItem.name}`;

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

    setSelectedOrder(finishedOrder);
    onUpdateOrder(finishedOrder);
    setCurrentState('REPORT');

    setLoadingAi(true);
    const analysis = await analyzeDiscrepancies(finishedOrder);
    setAiAnalysis(analysis);
    setLoadingAi(false);
    
    const orderWithAi = {
        ...finishedOrder,
        sessionData: { ...finishedOrder.sessionData!, geminiAnalysis: analysis }
    };
    onUpdateOrder(orderWithAi);
    setSelectedOrder(orderWithAi);
  };

  // --- RENDER ---

  if (currentState === 'SELECT_ORDER') {
    const availableOrders = orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.RETURNED);

    return (
      <div className="p-8 max-w-5xl mx-auto">
        <button onClick={onBack} className="mb-4 flex items-center text-gray-500 hover:text-gray-900">
          <ArrowLeft size={20} className="mr-2" /> Voltar
        </button>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Selecione um Pedido</h2>
            <div className="bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                <UserCheck size={16} className="mr-2"/>
                Conferente: {currentUser.name}
            </div>
        </div>
        
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
               <p className="text-gray-500">Nenhum pedido pendente.</p>
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
                  <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full font-bold border border-orange-200">RETORNO</span>
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
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Separador</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      list="separators-list"
                      type="text" 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="Nome do separador"
                      value={sessionForm.separatorName}
                      onChange={e => setSessionForm({...sessionForm, separatorName: e.target.value})}
                    />
                    {/* Autocomplete List */}
                    <datalist id="separators-list">
                        {availableSeparators.map((name, idx) => (
                            <option key={idx} value={name} />
                        ))}
                    </datalist>
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conferente (Logado)</label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-3 text-brand-600" size={18} />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 bg-gray-100 rounded-lg text-gray-600 font-medium cursor-not-allowed"
                      value={sessionForm.conferenteName}
                      disabled
                      title="Usuário logado"
                    />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motorista (Opcional)</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 text-gray-400" size={18} />
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

  // --- SCANNING & REPORT STATES (Mostly unchanged logic, just cleaner) ---
  if (currentState === 'SCANNING' && selectedOrder) {
      // (Mantém a lógica de renderização existente, apenas garantindo que as props novas não quebrem nada)
      // Recortei para não duplicar todo o arquivo, assumindo que o resto do render Scanning/Report é idêntico
      // Apenas a renderização do SETUP_SESSION e SELECT_ORDER mudou significativamente acima.
      
      // ... Re-inserting the existing Scanning Render Logic ...
      const isBlind = selectedOrder.sessionData?.mode === 'BLIND';
      const totalRequested = selectedOrder.items.reduce((acc, i) => acc + i.quantityRequested, 0);
      const totalScanned = selectedOrder.items.reduce((acc, i) => acc + i.quantityScanned, 0);
      const progress = totalRequested > 0 ? Math.round((totalScanned / totalRequested) * 100) : 0;

      return (
        <div className="h-full flex flex-col bg-gray-100 relative">
          
          {variantCandidates.length > 0 && (
              <div className="absolute inset-0 bg-dark-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                      <div className="bg-brand-600 p-4 text-white flex justify-between items-center">
                          <h3 className="text-lg font-bold flex items-center"><Split className="mr-2" /> Selecione a Variante</h3>
                          <button onClick={() => setVariantCandidates([])} className="hover:bg-brand-700 rounded-full p-1"><X size={20} /></button>
                      </div>
                      <div className="p-6">
                          <p className="text-center text-gray-500 mb-4">Código <span className="font-mono font-bold text-gray-800">{variantCandidates[0].sku}</span> duplicado. Qual item é?</p>
                          <div className="grid gap-3">
                              {variantCandidates.map((variantItem, idx) => (
                                  <button key={idx} onClick={() => openQuantityModal(variantItem)} className="flex justify-between items-center p-4 border rounded-lg hover:bg-brand-50 text-left">
                                      <div>
                                          <p className="font-bold">{variantItem.name}</p>
                                          {variantItem.variant && <span className="bg-gray-200 text-xs px-2 py-1 rounded">{variantItem.variant}</span>}
                                      </div>
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {pendingItem && (
            <div className="absolute inset-0 bg-dark-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-brand-600 p-4 text-white flex justify-between items-center">
                  <h3 className="text-lg font-bold flex items-center"><Calculator className="mr-2" /> Quantidade</h3>
                  <button onClick={cancelQuantity} className="hover:bg-brand-700 rounded-full p-1"><X size={20} /></button>
                </div>
                <form onSubmit={confirmQuantity} className="p-6">
                  <div className="mb-4 text-center">
                    <p className="text-xl font-bold">{pendingItem.name}</p>
                    <p className="text-sm text-gray-400">{pendingItem.sku} {pendingItem.variant && `(${pendingItem.variant})`}</p>
                  </div>
                  {!isBlind && (
                      <div className="flex justify-center gap-8 mb-6 bg-gray-50 p-3 rounded">
                          <div className="text-center"><span className="text-xs text-gray-500 block">PEDIDO</span><span className="font-bold">{pendingItem.quantityRequested}</span></div>
                          <div className="text-center"><span className="text-xs text-gray-500 block">CONTADO</span><span className="font-bold text-brand-600">{pendingItem.quantityScanned}</span></div>
                      </div>
                  )}
                  <input ref={quantityInputRef} type="number" min="1" value={quantityInput} onChange={(e) => setQuantityInput(e.target.value)} className="w-full text-center text-5xl font-bold py-6 border-2 border-brand-300 rounded-xl mb-6 outline-none focus:border-brand-600" placeholder="0" autoFocus />
                  <button type="submit" className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-brand-700">Confirmar</button>
                </form>
              </div>
            </div>
          )}

          <div className="bg-white p-4 border-b shadow-sm flex justify-between items-center">
            <div>
               <div className="flex items-center space-x-2 mb-1">
                   <span className="bg-gray-800 text-white text-xs font-bold px-2 py-0.5 rounded">{selectedOrder.id}</span>
                   {isBlind && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">CEGO</span>}
               </div>
               <h2 className="font-bold text-xl text-gray-900">{selectedOrder.customerName}</h2>
               <div className="text-sm text-gray-500 mt-1"><UserIcon size={14} className="inline mr-1"/> {selectedOrder.sessionData?.conferenteName}</div>
            </div>
            <div className="text-right">
              {!isBlind ? <><div className="text-3xl font-bold text-brand-600">{progress}%</div><div className="text-xs text-gray-400">Concluído</div></> : <EyeOff className="text-purple-400" size={32} />}
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            <div className="md:w-1/3 bg-gray-50 p-6 border-r border-gray-200 flex flex-col z-10">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase">Scan</label>
                  {showCamera ? (
                    <div className="mb-4">
                       <div id="reader" className="w-full rounded-lg overflow-hidden bg-black min-h-[250px] border-2 border-brand-500"></div>
                       <button onClick={stopCamera} className="mt-2 w-full flex items-center justify-center space-x-2 text-red-600 bg-red-50 py-3 rounded-lg"><VideoOff size={18} /><span>Cancelar</span></button>
                    </div>
                  ) : (
                    <>
                      <form onSubmit={handleScan} className="relative mb-3">
                        <ScanBarcode className="absolute left-3 top-3.5 text-gray-400" />
                        <input ref={scanInputRef} type="text" value={scanInput} onChange={(e) => setScanInput(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-brand-200 rounded-lg focus:border-brand-500 text-lg font-mono" placeholder="Escanear..." disabled={!!pendingItem} />
                      </form>
                      <button onClick={() => setShowCamera(true)} className="w-full flex items-center justify-center space-x-2 bg-blue-50 text-brand-700 py-3 rounded-lg font-medium border border-blue-200 mb-2"><Camera size={20} /><span>Câmera</span></button>
                    </>
                  )}
                  {scanMessage && <div className={`mt-4 p-3 rounded-lg flex items-center ${scanMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{scanMessage.type === 'success' ? <CheckCircle2 size={20} className="mr-2"/> : <AlertTriangle size={20} className="mr-2"/>}<span className="font-medium">{scanMessage.text}</span></div>}
               </div>
               <div className="mt-auto">
                 <button onClick={finishConference} className="w-full bg-dark-900 text-white py-4 rounded-xl font-bold flex justify-center items-center space-x-2"><Save size={20} /><span>Finalizar</span></button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-3">
                {selectedOrder.items.map((item, idx) => {
                  const isComplete = item.quantityScanned === item.quantityRequested;
                  const isOver = item.quantityScanned > item.quantityRequested;
                  let borderClass = 'border-gray-200';
                  if (!isBlind) {
                      if (isComplete) borderClass = 'border-green-200 bg-green-50';
                      else if (isOver) borderClass = 'border-red-200 bg-red-50';
                  }
                  return (
                    <div key={`${item.sku}-${idx}`} className={`p-4 rounded-lg border flex justify-between items-center ${borderClass} bg-white`}>
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${!isBlind && isComplete ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                           {!isBlind ? item.quantityScanned : (item.quantityScanned > 0 ? <CheckCircle2 size={20} className="text-blue-500"/> : 0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">{item.name}</h4>
                          <p className="text-sm font-mono text-gray-500">{item.sku} {item.variant && <span className="bg-gray-200 text-xs px-1 rounded">{item.variant}</span>}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {!isBlind ? <><span className="text-xs text-gray-500 uppercase">Solicitado</span><p className="font-bold text-xl">{item.quantityRequested}</p></> : <span className="text-xs text-gray-400">{item.quantityScanned > 0 ? 'Conferido' : 'Pendente'}</span>}
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

  // --- REPORT RENDER (Simplified for brevity as it didn't change logic) ---
  if (currentState === 'REPORT' && selectedOrder) {
      const isClean = selectedOrder.items.every(i => i.quantityScanned === i.quantityRequested);
      return (
        <div className="p-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
            <div className={`p-6 ${isClean ? 'bg-green-600' : 'bg-red-600'} text-white`}>
              <h2 className="text-3xl font-bold flex items-center">{isClean ? <CheckCircle2 size={32} className="mr-3" /> : <AlertTriangle size={32} className="mr-3" />} {isClean ? 'Conferência Aprovada' : 'Divergências'}</h2>
            </div>
            <div className="p-8">
              <div className="mb-8 bg-brand-50 border border-brand-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-brand-800 mb-3 flex items-center"><Search size={20} className="mr-2" /> Análise IA</h3>
                  {loadingAi ? <div className="animate-pulse"><div className="h-4 bg-brand-200 rounded w-3/4"></div></div> : <p className="text-brand-900 whitespace-pre-line">{aiAnalysis}</p>}
              </div>
              <table className="w-full text-left">
                <thead><tr className="border-b text-gray-500 text-sm"><th>Produto</th><th className="text-center">Solicitado</th><th className="text-center">Conferido</th></tr></thead>
                <tbody>
                  {selectedOrder.items.map((item, idx) => (
                      <tr key={idx} className="border-b">
                          <td className="py-3 font-medium">{item.name} <span className="text-xs text-gray-400">{item.sku}</span></td>
                          <td className="py-3 text-center">{item.quantityRequested}</td>
                          <td className={`py-3 text-center font-bold ${item.quantityScanned !== item.quantityRequested ? 'text-red-600' : 'text-green-600'}`}>{item.quantityScanned}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 p-6 flex justify-end space-x-3">
               <button onClick={onBack} className="px-6 py-2 bg-dark-900 text-white rounded-lg">Voltar ao Painel</button>
            </div>
          </div>
        </div>
      );
  }

  return <div>Carregando...</div>;
};

export default ConferenceFlow;