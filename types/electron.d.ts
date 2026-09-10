export interface Category {
  id: number;
  name: string;
  createdAt: string | Date;
  _count?: {
    products: number;
  };
}

export interface SaleProduct {
  id: number;
  name: string;
  sellingPrice: number;
  costPrice: number;
  stockQty: number;
  category?: Category | null;
}

export interface CartItem {
  productId: number;
  productName: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  availableStock: number;
  subtotal: number;
}

export type Product = {
  id: number;
  name: string;
  categoryId: number | null;
  category?: Category | null;
  costPrice: number;
  sellingPrice: number;
  stockQty: number;
  lowStockLevel: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type ProductFormData = {
  name: string;
  categoryId: number | null;
  costPrice: number;
  sellingPrice: number;
  stockQty: number;
  lowStockLevel: number;
  isActive?: boolean;
};

export type PaymentStatus = "UNPAID" | "PAID";
export type OrderStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export interface OrderItem {
  id?: number;
  productId?: number | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: number;
  customerName: string;
  phone: string;
  address: string;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  orderDate: string | Date;
  notes?: string | null;
  saleId?: number | null;
  items: OrderItem[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type OrderInput = Omit<Order, "id" | "totalAmount" | "createdAt" | "updatedAt">;

type ProductApi = {
  getAll: () => Promise<Product[]>;
  list: (filters: { page: number; pageSize: number; search?: string; categoryId?: number | string; stockStatus?: string; status?: "all" | "active" | "inactive" }) => Promise<{ products: Product[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>;
  search: (filters: { query: string; limit?: number }) => Promise<Array<{ id: number; name: string; sellingPrice: number; stockQty: number; lowStockLevel: number; categoryId: number | null; category?: { name: string } | null }>>;
  create: (data: ProductFormData) => Promise<Product>;
  update: (id: number, data: ProductFormData) => Promise<Product>;
  delete: (id: number) => Promise<{ success: boolean; code?: "PRODUCT_HAS_HISTORY" | "DELETE_FAILED"; canDeactivate?: boolean; message?: string }>;
  canDelete: (id: number) => Promise<{ canDelete: boolean; code?: "PRODUCT_HAS_HISTORY" | "DELETE_FAILED"; canDeactivate?: boolean }>;
  setActive: (id: number, isActive: boolean) => Promise<Product>;
};

type CategoryApi = {
  getAll: () => Promise<Category[]>;
  create: (data: { name: string }) => Promise<Category>;
  update: (id: number, data: { name: string }) => Promise<Category>;
  delete: (id: number) => Promise<void>;
};

type SalesApi = {
  create: (data: {
    items: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      costPrice: number;
      subtotal: number;
    }>;
    totalAmount: number;
    cashReceived: number;
    changeAmount: number;
  }) => Promise<{
    success: boolean;
    saleId: number;
    totalAmount: number;
    changeAmount: number;
  }>;
};

export type SaleStatus = "COMPLETED" | "CANCELLED";
export type SaleSource = "POS" | "ORDER";

export interface SaleHistoryItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  subtotal: number;
  profit: number;
}

export interface SaleHistoryRow {
  id: number;
  createdAt: string;
  totalAmount: number;
  cashReceived: number;
  changeAmount: number;
  status: SaleStatus;
  source: SaleSource;
  items: SaleHistoryItem[];
  itemCount: number;
  totalQuantity: number;
  grossProfit: number;
}

type SalesHistoryApi = {
  getAll: (filters?: { filterType?: string; month?: string; fromDate?: string; toDate?: string; search?: string; source?: string; status?: string; page?: number; pageSize?: number }) => Promise<{ sales: SaleHistoryRow[]; summary: { totalSales: number; grossProfit: number; transactions: number; itemsSold: number }; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>;
  getById: (id: number) => Promise<SaleHistoryRow>;
  voidSale: (id: number) => Promise<SaleHistoryRow>;
};

type OrdersApi = {
  getAll: () => Promise<Order[]>;
  getById: (id: number) => Promise<Order>;
  create: (data: OrderInput) => Promise<Order>;
  update: (id: number, data: OrderInput) => Promise<Order>;
  updateStatus: (id: number, status: OrderStatus) => Promise<Order>;
  updatePaymentStatus: (id: number, status: PaymentStatus) => Promise<Order>;
  delete: (id: number) => Promise<Order>;
};

export interface StockMovement {
  id: number;
  productId: number;
  type: string;
  quantity: number;
  note?: string | null;
  createdAt: string | Date;
  product: Product;
}

type StockApi = {
  getProducts: () => Promise<Product[]>;
  add: (productId: number, quantity: number, note: string) => Promise<Product>;
  adjust: (productId: number, quantity: number, reason: string, note: string) => Promise<Product>;
  getMovements: () => Promise<StockMovement[]>;
};

type DashboardApi = {
  getStats: () => Promise<{ todaySales: number; totalOrders: number; totalProducts: number; lowStockItems: number }>;
  getOverview: () => Promise<{
    todaySales: number;
    todayGrossProfit: number;
    last7DaysSales: number;
    monthSales: number;
    grossProfit: number;
    dailySales: Array<{ date: string; label: string; total: number }>;
  }>;
};

export interface ReportSummary {
  totalSales: number;
  grossProfit: number;
  transactions: number;
  itemsSold: number;
}

export interface ReportSummaryData {
  summary: ReportSummary;
  salesTrend: Array<{ date: string; label: string; total: number }>;
  topProducts: Array<{ productName: string; quantitySold: number; revenue: number; grossProfit: number }>;
  sourceBreakdown: Array<{ source: string; total: number }>;
  categoryPerformance: Array<{ categoryName: string; quantitySold: number; revenue: number; grossProfit: number }>;
  orderPaymentSummary: { paidOrders: number; unpaidOrders: number };
  stockSummary: { lowStockItems: number; outOfStockItems: number };
}

type ReportsApi = {
  getSummary: (filters: { preset: string; startDate?: string; endDate?: string }) => Promise<ReportSummaryData>;
};

export interface BackupStatus {
  databaseName: string;
  databasePath: string;
  databaseSize: number;
  backupDirectory: string;
  lastBackup: string | null;
}

export interface BackupHistoryItem {
  fileName: string;
  fullPath: string;
  createdAt: string;
  size: number;
}

type BackupApi = {
  getStatus: () => Promise<BackupStatus>;
  create: () => Promise<BackupHistoryItem>;
  getHistory: () => Promise<BackupHistoryItem[]>;
  selectFile: () => Promise<string | null>;
  restore: (backupPath: string) => Promise<{ success: boolean; restarting: boolean }>;
  openFolder: () => Promise<string>;
};

export interface PosSettings {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  receiptFooter: string;
  receiptShowShopName: boolean;
  receiptShowPhone: boolean;
  receiptShowAddress: boolean;
  receiptShowFooter: boolean;
  defaultLowStockLevel: number;
  allowUnpaidOrderCompletion: boolean;
}

export interface SystemInfo {
  appVersion: string;
  databaseName: string;
  databasePath: string;
  backupPath: string;
}

type SettingsApi = {
  getAll: () => Promise<PosSettings>;
  update: (settings: PosSettings) => Promise<PosSettings>;
  getSystemInfo: () => Promise<SystemInfo>;
};

interface ElectronApi {
  products: ProductApi;
  categories: CategoryApi;
  sales: SalesApi;
  salesHistory: SalesHistoryApi;
  orders: OrdersApi;
  stock: StockApi;
  dashboard: DashboardApi;
  reports: ReportsApi;
  backup: BackupApi;
  settings: SettingsApi;
}

declare global {
  interface Window {
    electron: ElectronApi;
  }
}

export {};
