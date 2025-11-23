import React, { useState } from 'react';
import { Order, OrderStatus, CorrectionLog } from '../types';
import { 
    CheckCircle2, 
    AlertTriangle, 
    FileText, 
    CalendarDays, 
    Search, 
    X, 
    Edit2, 
    Save, 
    History as HistoryIcon,
    RotateCcw,
    Truck
} from 'lucide-react';

interface HistoryLogProps {
  orders: Order[];
  onCorrectOrder?: (orderId: string, itemId: string, newQuantity: number, reason: string, user: string) => void;
  onReturnOrder?: (orderId: string, reason: string, driverName: string) => void;
}

const HistoryLog: React.FC<HistoryLogProps> = ({ orders, onCorrectOrder, onReturnOrder }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
  
  // Estado para o formulário de correção
  const [editingItemSku, setEditingItemSku] = useState<string | null>(null);
  const [correctionQty, setCorrectionQty] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');

  // Estado para Logística Reversa (Retorno)
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnDriver, setReturnDriver] = useState('');

  // Filtragem e Ordenação
  const history = orders.filter(o => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.COMPLETED_WITH_ERRORS || o.status === OrderStatus.RETURNED)
    .sort((a, b) => new Date(b.sessionData?.endTime || '').getTime() - new Date(a.sessionData?.endTime || '').getTime());

  // Stats do Dia
  const today = new Date().toDateString();
  const todaysDeliveries = history.filter(o => new Date(o.sessionData?.endTime || '').toDateString() === today && o.status !== OrderStatus.RETURNED);
  const totalLoadedItems = todaysDeliveries.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantityScanned, 0), 0);

  // Handlers
  const handleOpenDetails = (order: Order) => {
      setSelectedOrder(order);
      setIsCorrectionMode(false);
      setEditingItemSku(null);
      setShowReturnModal(false);
      
      // Pre-fill driver if available for return logic
      if(order.sessionData?.driverName) {
          setReturnDriver(order.sessionData.driverName);
      }
  };

  const handleStartCorrection = (sku: string, currentQty: number) => {
      setEditingItemSku(sku);
      setCorrectionQty(currentQty.toString());
      setCorrectionReason('');
  };

  const handleSaveCorrection = () => {
      if (!selectedOrder || !editingItemSku || !onCorrectOrder) return;
      
      const newQty = parseInt(correctionQty, 10);
      if (isNaN(newQty) || newQty < 0) {
          alert("Quantidade inválida");
          return;
      }
      
      if (!correctionReason.trim()) {
          alert("É obrigatório informar o motivo da correção.");
          return;
      }

      onCorrectOrder(selectedOrder.id, editingItemSku, newQty, correctionReason, "Supervisor");
      setEditingItemSku(null);
      alert("Correção registrada com sucesso!");
  };

  const handleRegisterReturn = () => {
      if(!selectedOrder || !onReturnOrder) return;
      if(!returnReason.trim()) {
          alert("Informe o motivo do retorno.");
          return;
      }
      if(!returnDriver.trim()) {
          alert("Confirme o nome do motorista responsável.");
          return;
      }

      onReturnOrder(selectedOrder.id, returnReason, returnDriver);
      setShowReturnModal(false);
      setSelectedOrder(null); // Close main modal
      alert("Retorno registrado! O pedido voltou para a lista de conferência.");
  };

  return (
    <div className="p-8 max-w-6xl mx-auto relative">
      
      {/* Header Stats */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Histórico de Conferências</h2>
            <p className="text-gray-500 mt-1">Registro completo de cargas e auditoria.</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center space-x-6 mt-4 md:mt-0">
              <div className="text-right">
                  <span className="block text-xs text-gray-500 uppercase font-bold">Entregas Hoje</span>
                  <span className="block text-2xl font-bold text-brand-600">{todaysDeliveries.length}</span>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-right">
                  <span className="block text-xs text-gray-500 uppercase font-bold">Itens Carregados</span>
                  <span className="block text-2xl font-bold text-gray-800">{totalLoadedItems}</span>
              </div>
              <div className="bg-brand-100 p-2 rounded-full text-brand-600">
                  <CalendarDays size={24} />
              </div>
          </div>
      </div>
      
      {/* Tabela Principal */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pedido / Cliente</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Finalização</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Responsáveis</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {history.map(order => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-900">{order.id}</div>
                  <div className="text-sm text-gray-500">{order.customerName}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(order.sessionData?.endTime || '').toLocaleDateString()} <br/>
                  <span className="text-gray-400 text-xs">{new Date(order.sessionData?.endTime || '').toLocaleTimeString()}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <span className="block"><span className="font-medium text-gray-900">Mot:</span> {order.sessionData?.driverName || '-'}</span>
                  <span className="block text-xs text-gray-500"><span className="font-medium">Sep:</span> {order.sessionData?.separatorName}</span>
                </td>
                <td className="px-6 py-4">
                   {order.status === OrderStatus.COMPLETED ? (
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                         <CheckCircle2 size={14} className="mr-1" /> Aprovado
                       </span>
                   ) : order.status === OrderStatus.RETURNED ? (
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                         <RotateCcw size={14} className="mr-1" /> Devolvido
                       </span>
                   ) : (
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                         <AlertTriangle size={14} className="mr-1" /> Divergente
                       </span>
                   )}
                   {order.correctionHistory && order.correctionHistory.length > 0 && (
                       <div className="mt-1 flex items-center text-xs text-orange-600">
                           <HistoryIcon size={10} className="mr-1" /> Corrigido ({order.correctionHistory.length})
                       </div>
                   )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleOpenDetails(order)}
                    className="text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-md font-medium text-sm inline-flex items-center transition-colors"
                  >
                    <FileText size={16} className="mr-1" /> Detalhes
                  </button>
                </td>
              </tr>
            ))}
             {history.length === 0 && (
                <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        Nenhum histórico disponível.
                    </td>
                </tr>
             )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE DETALHES E CORREÇÃO */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300 flex flex-col">
                
                {/* Modal Header */}
                <div className="p-6 border-b border-gray-200 flex justify-between items-start bg-gray-50 sticky top-0 z-10">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900">Detalhes do Pedido</h3>
                        <p className="text-gray-500">{selectedOrder.id} - {selectedOrder.customerName}</p>
                    </div>
                    <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-200 rounded-full">
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Botão de Registrar Retorno */}
                    {selectedOrder.status !== OrderStatus.RETURNED && (
                        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-orange-800 flex items-center"><RotateCcw size={18} className="mr-2"/> Logística Reversa</h4>
                                <p className="text-sm text-orange-600">Este pedido retornou de uma entrega?</p>
                            </div>
                            <button 
                                onClick={() => setShowReturnModal(true)}
                                className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors shadow-sm"
                            >
                                Registrar Retorno
                            </button>
                        </div>
                    )}

                    {/* Informações Gerais */}
                    <div className="grid grid-cols-2 gap-4 mb-8 bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Separador</span>
                            <span className="font-medium">{selectedOrder.sessionData?.separatorName}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Conferente</span>
                            <span className="font-medium">{selectedOrder.sessionData?.conferenteName}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Motorista</span>
                            <span className="font-medium">{selectedOrder.sessionData?.driverName || 'Não informado'}</span>
                        </div>
                         <div>
                            <span className="block text-xs text-gray-500 uppercase">Veículo</span>
                            <span className="font-medium">{selectedOrder.sessionData?.vehiclePlate || '-'}</span>
                        </div>
                    </div>

                    {/* Formulário de Retorno (Condicional) */}
                    {showReturnModal && (
                        <div className="mb-8 bg-white border-2 border-orange-300 p-4 rounded-xl shadow-lg animate-in fade-in zoom-in duration-200">
                             <h4 className="font-bold text-gray-800 mb-3 text-lg">Detalhes da Devolução</h4>
                             <div className="space-y-3">
                                 <div>
                                     <label className="block text-xs font-bold text-gray-700 mb-1">Motivo da Re-entrega / Retorno</label>
                                     <input 
                                        type="text"
                                        className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500"
                                        placeholder="Ex: Cliente fechado, Recusa, Produto Avariado..."
                                        value={returnReason}
                                        onChange={e => setReturnReason(e.target.value)}
                                        autoFocus
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-gray-700 mb-1">Motorista Responsável pelo Retorno</label>
                                     <input 
                                        type="text"
                                        className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500"
                                        value={returnDriver}
                                        onChange={e => setReturnDriver(e.target.value)}
                                     />
                                 </div>
                                 <div className="flex space-x-2 pt-2">
                                     <button 
                                        onClick={handleRegisterReturn}
                                        className="flex-1 bg-orange-600 text-white font-bold py-2 rounded hover:bg-orange-700"
                                     >
                                         Confirmar Devolução
                                     </button>
                                     <button 
                                        onClick={() => setShowReturnModal(false)}
                                        className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-100"
                                     >
                                         Cancelar
                                     </button>
                                 </div>
                             </div>
                        </div>
                    )}

                    {/* Lista de Itens com Ação de Correção */}
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                        <span>Itens Conferidos</span>
                        {!isCorrectionMode && selectedOrder.status !== OrderStatus.RETURNED ? (
                            <button 
                                onClick={() => setIsCorrectionMode(true)} 
                                className="text-sm text-brand-600 hover:underline flex items-center"
                            >
                                <Edit2 size={14} className="mr-1" /> Habilitar Correção
                            </button>
                        ) : isCorrectionMode ? (
                             <button 
                                onClick={() => setIsCorrectionMode(false)} 
                                className="text-sm text-gray-500 hover:underline"
                            >
                                Cancelar Edição
                            </button>
                        ) : null}
                    </h4>
                    
                    <div className="space-y-3">
                        {selectedOrder.items.map(item => {
                            const diff = item.quantityScanned - item.quantityRequested;
                            const isError = diff !== 0;
                            const isEditing = editingItemSku === item.sku;

                            return (
                                <div key={item.sku} className={`p-4 rounded-lg border ${isError ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h5 className="font-bold text-gray-800">{item.name}</h5>
                                            <span className="text-xs font-mono text-gray-500">{item.sku}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-500">Solicitado: {item.quantityRequested}</div>
                                            <div className={`font-bold ${isError ? 'text-red-600' : 'text-green-600'}`}>
                                                Conferido: {item.quantityScanned}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Status da Divergência */}
                                    {isError && !isEditing && (
                                        <div className="mt-2 text-sm text-red-700 font-medium bg-red-100/50 p-1 px-2 rounded inline-block">
                                            {diff > 0 ? `SOBRA: +${diff}` : `FALTA: ${diff}`}
                                        </div>
                                    )}

                                    {/* Botão de Correção (Só aparece se modo edição ativo e não estiver editando este item) */}
                                    {isCorrectionMode && !isEditing && (
                                        <div className="mt-3 pt-3 border-t border-dashed border-gray-300">
                                            <button 
                                                onClick={() => handleStartCorrection(item.sku, item.quantityScanned)}
                                                className="text-sm bg-white border border-gray-300 px-3 py-1 rounded shadow-sm hover:bg-gray-50 flex items-center text-gray-700"
                                            >
                                                <Edit2 size={12} className="mr-2" /> Corrigir Quantidade
                                            </button>
                                        </div>
                                    )}

                                    {/* Formulário de Edição */}
                                    {isEditing && (
                                        <div className="mt-3 bg-white border border-brand-300 p-3 rounded shadow-sm animate-in zoom-in duration-150">
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Nova Quantidade Real</label>
                                            <input 
                                                type="number" 
                                                className="w-full border border-gray-300 rounded px-2 py-1 mb-2"
                                                value={correctionQty}
                                                onChange={(e) => setCorrectionQty(e.target.value)}
                                            />
                                            
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Motivo da Correção (Obrigatório)</label>
                                            <textarea 
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-3"
                                                placeholder="Ex: Erro de digitação do conferente, item encontrado depois..."
                                                rows={2}
                                                value={correctionReason}
                                                onChange={(e) => setCorrectionReason(e.target.value)}
                                            />

                                            <div className="flex space-x-2">
                                                <button 
                                                    onClick={handleSaveCorrection}
                                                    className="flex-1 bg-brand-600 text-white text-sm py-1.5 rounded hover:bg-brand-700 flex justify-center items-center"
                                                >
                                                    <Save size={14} className="mr-1" /> Salvar
                                                </button>
                                                <button 
                                                    onClick={() => setEditingItemSku(null)}
                                                    className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Histórico de Correções e Retornos */}
                    <div className="mt-8 border-t border-gray-200 pt-6">
                        
                        {/* Retornos */}
                        {selectedOrder.returnHistory && selectedOrder.returnHistory.length > 0 && (
                            <div className="mb-6">
                                <h4 className="font-bold text-orange-800 mb-3 flex items-center">
                                    <RotateCcw size={18} className="mr-2" /> Histórico de Devoluções
                                </h4>
                                <div className="space-y-3">
                                    {selectedOrder.returnHistory.map((ret, idx) => (
                                        <div key={idx} className="text-sm bg-orange-50 p-3 rounded border border-orange-100">
                                            <div className="flex justify-between text-orange-600 text-xs mb-1">
                                                <span>{new Date(ret.date).toLocaleString()}</span>
                                                <span className="font-bold flex items-center"><Truck size={12} className="mr-1"/>{ret.driverName}</span>
                                            </div>
                                            <p className="text-gray-800 font-medium">{ret.reason}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Correções */}
                        {selectedOrder.correctionHistory && selectedOrder.correctionHistory.length > 0 && (
                            <div>
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                                    <HistoryIcon size={18} className="mr-2 text-gray-500" />
                                    Histórico de Alterações Manuais
                                </h4>
                                <div className="space-y-4">
                                    {selectedOrder.correctionHistory.map((log, idx) => (
                                        <div key={idx} className="text-sm bg-gray-50 p-3 rounded border border-gray-100">
                                            <div className="flex justify-between text-gray-500 text-xs mb-1">
                                                <span>{new Date(log.date).toLocaleString()}</span>
                                                <span className="font-bold">{log.user}</span>
                                            </div>
                                            <p className="text-gray-800">
                                                Alterou item <span className="font-mono font-bold">{log.sku}</span> de 
                                                <span className="font-bold text-red-600 mx-1">{log.oldQuantity}</span> 
                                                para 
                                                <span className="font-bold text-green-600 mx-1">{log.newQuantity}</span>
                                            </p>
                                            <p className="text-gray-600 italic mt-1">"{log.reason}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default HistoryLog;