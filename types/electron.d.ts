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
  items: OrderItem[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type OrderInput = Omit<Order, "id" | "totalAmount" | "createdAt" | "updatedAt">;

type ProductApi = {
  getAll: () => Promise<Product[]>;
  create: (data: ProductFormData) => Promise<Product>;
  update: (id: number, data: ProductFormData) => Promise<Product>;
  delete: (id: number) => Promise<Product>;
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

type OrdersApi = {
  getAll: () => Promise<Order[]>;
  getById: (id: number) => Promise<Order>;
  create: (data: OrderInput) => Promise<Order>;
  update: (id: number, data: OrderInput) => Promise<Order>;
  updateStatus: (id: number, status: OrderStatus) => Promise<Order>;
  updatePaymentStatus: (id: number, status: PaymentStatus) => Promise<Order>;
  delete: (id: number) => Promise<Order>;
};

type DashboardApi = {
  getStats: () => Promise<{ todaySales: number; totalOrders: number; totalProducts: number; lowStockItems: number }>;
};

interface ElectronApi {
  products: ProductApi;
  categories: CategoryApi;
  sales: SalesApi;
  orders: OrdersApi;
  dashboard: DashboardApi;
}

declare global {
  interface Window {
    electron: ElectronApi;
  }
}

export {};
