import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, Check, Plus, Trash2, FileSpreadsheet, Keyboard } from 'lucide-react';
import { Order, OrderStatus, ProductItem } from '../types';

interface ImportOrdersProps {
  onImport: (orders: Order[]) => void;
}

const ImportOrders: React.FC<ImportOrdersProps> = ({ onImport }) => {
  const [mode, setMode] = useState<'csv' | 'manual'>('csv');
  
  // CSV State
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Entry State
  const [manualOrder, setManualOrder] = useState<{
    id: string;
    customerName: string;
    customerCode: string;
  }>({ id: '', customerName: '', customerCode: '' });
  
  const [manualItems, setManualItems] = useState<Partial<ProductItem>[]>([]);
  const [newItem, setNewItem] = useState({ sku: '', name: '', quantityRequested: '' });

  // --- CSV Handlers ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      setError("Por favor envie um arquivo CSV válido.");
      return;
    }
    setFile(file);
    setError(null);
  };

  const processFile = () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsedOrders = parseCSV(text);
        if (parsedOrders.length > 0) {
            onImport(parsedOrders);
        } else {
            setError("Nenhum pedido válido encontrado no CSV. Verifique o formato.");
        }
      } catch (err) {
        setError("Erro ao ler CSV. Verifique o formato das colunas.");
      }
    };
    reader.readAsText(file);
  };

  // CSV Parser logic based on requested format:
  // Col 0: Barcode (used as primary scan key -> sku)
  // Col 1: Description (name)
  // Col 2: Quantity (quantityRequested)
  // Col 3: Customer Code
  // Col 4: Internal Code (optional, usually maps to internal ID)
  // Col 5: SKU (Display SKU or alternative ID)
  const parseCSV = (csvText: string): Order[] => {
    const lines = csvText.split('\n');
    const ordersMap = new Map<string, Order>();

    // Simple heuristic to skip header if first row contains text "barcode" or "codigo"
    const firstLine = lines[0].toLowerCase();
    const startIndex = (firstLine.includes('barcode') || firstLine.includes('código') || firstLine.includes('codigo')) ? 1 : 0;

    // Generate a temporary Order ID since the CSV format provided is Item-based, not explicitly Order-based per row.
    // Assuming one CSV file = One Import Batch, likely generating one or multiple orders based on Customer Code.
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Split by comma or semicolon
      const cols = line.split(/[,;]/).map(c => c.trim());
      
      // Validate column count (at least 3 essential columns: barcode, desc, qty)
      if (cols.length < 3) continue;

      const barcode = cols[0]; // Cód Barra (Scan Key)
      const description = cols[1]; // Descrição
      const qtyStr = cols[2]; // Quantidade
      const customerCode = cols[3] || 'CLI-GENERICO'; // Cód Cliente
      // const internalCode = cols[4]; // Cód Interno (Ignored for now or added to metadata)
      const displaySku = cols[5] || barcode; // SKU

      const qty = parseInt(qtyStr, 10);
      if (isNaN(qty)) continue;

      // Group by Customer Code to create Orders
      // If Customer Code is missing, group into a generic "Imported Order"
      const orderId = `PED-${new Date().getTime().toString().slice(-6)}-${customerCode}`;

      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          id: orderId,
          customerCode: customerCode,
          customerName: `Cliente ${customerCode}`, // Placeholder name if not provided
          status: OrderStatus.PENDING,
          items: [],
          createdAt: new Date().toISOString()
        });
      }

      const order = ordersMap.get(orderId)!;
      
      // Check if item already exists in order to merge lines
      const existingItem = order.items.find(item => item.sku === barcode);
      if (existingItem) {
          existingItem.quantityRequested += qty;
      } else {
          order.items.push({
            sku: barcode, // Important: This is what determines the scan match
            name: description,
            quantityRequested: qty,
            quantityScanned: 0,
            // store display SKU if needed in future, currently simplified
          });
      }
    }
    return Array.from(ordersMap.values());
  };

  // --- Manual Entry Handlers ---
  const addManualItem = () => {
    if (!newItem.sku || !newItem.name || !newItem.quantityRequested) return;
    
    setManualItems([...manualItems, {
        sku: newItem.sku,
        name: newItem.name,
        quantityRequested: parseInt(newItem.quantityRequested, 10),
        quantityScanned: 0
    }]);
    setNewItem({ sku: '', name: '', quantityRequested: '' });
  };

  const removeManualItem = (index: number) => {
    const updated = [...manualItems];
    updated.splice(index, 1);
    setManualItems(updated);
  };

  const saveManualOrder = () => {
    if (!manualOrder.id || !manualOrder.customerName || manualItems.length === 0) {
        alert("Preencha os dados do pedido e adicione pelo menos um item.");
        return;
    }

    const newOrder: Order = {
        id: manualOrder.id,
        customerName: manualOrder.customerName,
        customerCode: manualOrder.customerCode || 'N/A',
        status: OrderStatus.PENDING,
        createdAt: new Date().toISOString(),
        items: manualItems as ProductItem[]
    };

    onImport([newOrder]);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Importar Pedidos</h2>
      <p className="text-gray-500 mb-8">Adicione novos pedidos ao sistema para iniciar a conferência.</p>

      {/* Tabs */}
      <div className="flex mb-8 bg-white rounded-lg p-1 shadow-sm border border-gray-200 inline-flex">
        <button 
          onClick={() => setMode('csv')}
          className={`px-4 py-2 rounded-md flex items-center space-x-2 text-sm font-medium transition-colors ${
            mode === 'csv' ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileSpreadsheet size={18} />
          <span>Arquivo CSV</span>
        </button>
        <button 
          onClick={() => setMode('manual')}
          className={`px-4 py-2 rounded-md flex items-center space-x-2 text-sm font-medium transition-colors ${
            mode === 'manual' ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Keyboard size={18} />
          <span>Entrada Manual</span>
        </button>
      </div>

      {mode === 'csv' ? (
        <>
          <div 
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-300 bg-white'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept=".csv"
              onChange={handleChange}
            />
            
            <div className="flex flex-col items-center">
              <div className="bg-brand-100 p-4 rounded-full mb-4">
                <Upload className="text-brand-600" size={32} />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">Arraste seu arquivo aqui</h3>
              <p className="text-gray-500 mb-6">ou clique para selecionar do computador</p>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Selecionar Arquivo
              </button>
            </div>
          </div>

          {file && (
            <div className="mt-6 bg-white p-4 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm">
              <div className="flex items-center space-x-3">
                <FileText className="text-brand-600" size={24} />
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button 
                onClick={processFile}
                className="bg-brand-600 text-white px-6 py-2 rounded-lg hover:bg-brand-700 font-medium flex items-center space-x-2"
              >
                <Check size={18} />
                <span>Processar Importação</span>
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 text-red-700 p-4 rounded-lg flex items-center space-x-2">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-12">
            <h4 className="font-semibold text-gray-700 mb-3">Formato Esperado (CSV)</h4>
            <div className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <p className="mb-2 text-gray-400">// Ordem das colunas (sem cabeçalho ou com cabeçalho ignorado):</p>
              <p>1. Código de Barras (Usado para scan)</p>
              <p>2. Descrição do Produto</p>
              <p>3. Quantidade Solicitada</p>
              <p>4. Cód. do Cliente (Usado para agrupar pedidos)</p>
              <p>5. Cód. Interno (Opcional)</p>
              <p>6. SKU (Opcional)</p>
              <p className="mt-4 text-gray-400">// Exemplo:</p>
              7891000123, Arroz Tipo 1 5kg, 100, CLI-500, INT-99, SKU-A1<br/>
              7891000456, Feijão Preto 1kg, 50, CLI-500, INT-88, SKU-B2
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="border-b border-gray-100 pb-4 mb-6">
                <h3 className="text-xl font-bold text-gray-800">Novo Pedido Manual</h3>
                <p className="text-sm text-gray-500">Crie um pedido manualmente caso não possua o arquivo CSV.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nº Pedido (ID)</label>
                    <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        placeholder="Ex: PED-2024-001"
                        value={manualOrder.id}
                        onChange={e => setManualOrder({...manualOrder, id: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente</label>
                    <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        placeholder="Ex: Supermercado Central"
                        value={manualOrder.customerName}
                        onChange={e => setManualOrder({...manualOrder, customerName: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cód. Cliente</label>
                    <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        placeholder="Ex: CLI-999"
                        value={manualOrder.customerCode}
                        onChange={e => setManualOrder({...manualOrder, customerCode: e.target.value})}
                    />
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 mb-6">
                <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Adicionar Item</h4>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-3">
                         <label className="block text-xs text-gray-500 mb-1">Cód. Barras / SKU</label>
                        <input 
                            type="text" 
                            placeholder="789..." 
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                            value={newItem.sku}
                            onChange={e => setNewItem({...newItem, sku: e.target.value})}
                        />
                    </div>
                    <div className="md:col-span-6">
                        <label className="block text-xs text-gray-500 mb-1">Descrição do Produto</label>
                        <input 
                            type="text" 
                            placeholder="Nome do produto" 
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                            value={newItem.name}
                            onChange={e => setNewItem({...newItem, name: e.target.value})}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Quantidade</label>
                        <input 
                            type="number" 
                            placeholder="0" 
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                            value={newItem.quantityRequested}
                            onChange={e => setNewItem({...newItem, quantityRequested: e.target.value})}
                        />
                    </div>
                    <div className="md:col-span-1">
                        <button 
                            onClick={addManualItem}
                            className="w-full bg-brand-600 text-white rounded px-2 py-2 hover:bg-brand-700 flex justify-center items-center"
                            title="Adicionar Item"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase border-b pb-2 flex justify-between">
                    <span>Itens no Pedido</span>
                    <span className="text-brand-600">{manualItems.length} itens</span>
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 rounded-lg p-2 min-h-[100px]">
                    {manualItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-3 rounded shadow-sm border border-gray-200">
                            <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-3 font-mono text-xs text-gray-500">{item.sku}</div>
                                <div className="col-span-7 font-medium text-sm text-gray-800">{item.name}</div>
                                <div className="col-span-2 font-bold text-brand-600 text-right">{item.quantityRequested} un</div>
                            </div>
                            <button onClick={() => removeManualItem(idx)} className="ml-4 text-gray-400 hover:text-red-500 p-1 transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                    {manualItems.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 py-8">
                            <p className="text-sm italic">Nenhum item adicionado ainda.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
                <button 
                    onClick={saveManualOrder}
                    className="bg-brand-600 text-white px-8 py-3 rounded-lg hover:bg-brand-700 font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center space-x-2"
                >
                    <Check size={20} />
                    <span>Finalizar e Importar</span>
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default ImportOrders;