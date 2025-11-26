export enum OrderStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  COMPLETED_WITH_ERRORS = 'COMPLETED_WITH_ERRORS',
  RETURNED = 'RETURNED'
}

export interface User {
  username: string;
  name: string;
  role: 'admin' | 'user';
}

export interface ProductItem {
  sku: string;
  name: string;
  variant?: string;
  quantityRequested: number;
  quantityScanned: number;
  image?: string;
}

export interface CorrectionLog {
  date: string;
  user: string;
  sku: string;
  oldQuantity: number;
  newQuantity: number;
  reason: string;
}

export interface ReturnEvent {
  date: string;
  reason: string;
  driverName: string;
  registeredBy: string;
}

export interface Order {
  id: string;
  customerCode: string;
  customerName: string;
  items: ProductItem[];
  status: OrderStatus;
  createdAt: string;
  sessionData?: ConferenceSession;
  correctionHistory?: CorrectionLog[];
  returnHistory?: ReturnEvent[];
}

export interface ConferenceSession {
  separatorName: string;
  conferenteName: string;
  driverName: string;
  vehiclePlate: string;
  startTime: string;
  endTime?: string;
  geminiAnalysis?: string;
  mode?: 'OPEN' | 'BLIND';
}

export interface DashboardStats {
  totalOrders: number;
  accuracyRate: number;
  pending: number;
  completed: number;
}