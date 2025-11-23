import { Order, OrderStatus } from "../types";

const DB_NAME = 'ConfereX_DB';
const DB_VERSION = 1;
const STORE_NAME = 'orders';

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

export const getAllOrders = (): Promise<Order[]> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result as Order[]);
      };

      getAllRequest.onerror = () => {
        reject("Error fetching orders");
      };
    };
  });
};

export const saveOrder = (order: Order): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const putRequest = store.put(order);

      putRequest.onsuccess = () => {
        resolve();
      };

      putRequest.onerror = () => {
        reject("Error saving order");
      };
    };
  });
};

export const saveAllOrders = (orders: Order[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject("Error saving batch orders");
      };

      orders.forEach(order => {
        store.put(order);
      });
    };
  });
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