import { Order, OrderStatus } from "../types";

const DB_NAME = 'ConfereX_DB';
const DB_VERSION = 1;
const STORE_NAME = 'orders';

// Helpers de Configuração
const getConfig = () => {
    const dataSource = localStorage.getItem('app_data_source') || 'local';
    const apiUrl = localStorage.getItem('app_api_url');
    return { dataSource, apiUrl };
}

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      reject("Error opening database");
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve();
    };
  });
};

const getFromLocalDB = (): Promise<Order[]> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => resolve(getAllRequest.result as Order[]);
          getAllRequest.onerror = () => reject("Error fetching orders locally");
        };
        request.onerror = () => reject("Error opening DB locally");
    });
}

export const getAllOrders = async (): Promise<Order[]> => {
  const { dataSource, apiUrl } = getConfig();

  // Se configurado para API, tenta buscar remotamente primeiro
  if (dataSource === 'api' && apiUrl) {
      try {
          // fetch simulado para API - em produção seria:
          // const res = await fetch(`${apiUrl}/orders`);
          // if (!res.ok) throw new Error('API Error');
          // return await res.json();
          
          console.log(`[StorageService] Tentando buscar dados de: ${apiUrl}`);
          // Simula falha para cair no fallback se não for URL válida
          if (!apiUrl.startsWith('http')) throw new Error('Invalid URL');
          
          // Como não temos backend real, vamos simular um erro para usar o fallback local
          // e garantir que o app funcione para o usuário
          throw new Error('Backend simulation: Fallback to local');
      } catch (error) {
          console.warn("[StorageService] API Indisponível, usando cache local (Offline Mode)", error);
          return getFromLocalDB();
      }
  }

  // Padrão: Banco Local
  return getFromLocalDB();
};

export const saveOrder = async (order: Order): Promise<void> => {
  const { dataSource, apiUrl } = getConfig();
  
  // Salva no banco local primeiro (sempre garante persistência imediata)
  await saveOrderToLocalDB(order);

  // Se API configurada, tenta sincronizar em segundo plano
  if (dataSource === 'api' && apiUrl) {
      try {
          // fetch(`${apiUrl}/orders/${order.id}`, { method: 'PUT', body: JSON.stringify(order) });
          console.log(`[StorageService] Sincronizando pedido ${order.id} com API...`);
      } catch (e) {
          console.warn("[StorageService] Falha na sincronia remota, dados salvos localmente.");
      }
  }
};

const saveOrderToLocalDB = (order: Order): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const putRequest = store.put(order);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject("Error saving order");
    };
  });
};

export const saveAllOrders = async (orders: Order[]): Promise<void> => {
  const { dataSource, apiUrl } = getConfig();
  
  // Salva localmente
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject("Error saving batch");
      orders.forEach(order => store.put(order));
    };
  });

  // Tenta sync remoto se aplicável
  if (dataSource === 'api' && apiUrl) {
      console.log(`[StorageService] Sincronizando lote de ${orders.length} pedidos com API...`);
  }
};

export const deleteOrdersByDateRange = (startDate: Date, endDate: Date): Promise<number> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getAllRequest = store.getAll();
            let deletedCount = 0;

            getAllRequest.onsuccess = () => {
                const orders = getAllRequest.result as Order[];
                orders.forEach(order => {
                    // Only delete completed orders (Reports data)
                    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.COMPLETED_WITH_ERRORS) {
                        const orderDate = new Date(order.sessionData?.endTime || order.createdAt);
                        if (orderDate >= startDate && orderDate <= endDate) {
                            store.delete(order.id);
                            deletedCount++;
                        }
                    }
                });
            };

            transaction.oncomplete = () => {
                resolve(deletedCount);
            };

            transaction.onerror = () => {
                reject("Error deleting orders");
            };
        };
    });
};

export const clearDB = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject();
    });
};