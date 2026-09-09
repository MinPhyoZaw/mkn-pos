const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  products: {
    getAll: () => ipcRenderer.invoke("products:getAll"),
    list: (filters) => ipcRenderer.invoke("products:list", filters),
    search: (filters) => ipcRenderer.invoke("products:search", filters),
    create: (data) => ipcRenderer.invoke("products:create", data),
    update: (id, data) => ipcRenderer.invoke("products:update", id, data),
    delete: (id) => ipcRenderer.invoke("products:delete", id),
  },

  categories: {
    getAll: () => ipcRenderer.invoke("categories:getAll"),
    create: (data) => ipcRenderer.invoke("categories:create", data),
    update: (id, data) => ipcRenderer.invoke("categories:update", id, data),
    delete: (id) => ipcRenderer.invoke("categories:delete", id),
  },

  sales: {
    create: (data) => ipcRenderer.invoke("sales:create", data),
  },

  salesHistory: {
    getAll: (filters) => ipcRenderer.invoke("salesHistory:getAll", filters),
    getById: (id) => ipcRenderer.invoke("salesHistory:getById", id),
    voidSale: (id) => ipcRenderer.invoke("salesHistory:voidSale", id),
  },

  orders: {
    getAll: () => ipcRenderer.invoke("orders:getAll"),
    getById: (id) => ipcRenderer.invoke("orders:getById", id),
    create: (data) => ipcRenderer.invoke("orders:create", data),
    update: (id, data) => ipcRenderer.invoke("orders:update", id, data),
    updateStatus: (id, status) => ipcRenderer.invoke("orders:updateStatus", id, status),
    updatePaymentStatus: (id, status) => ipcRenderer.invoke("orders:updatePaymentStatus", id, status),
    delete: (id) => ipcRenderer.invoke("orders:delete", id),
  },

  stock: {
    getProducts: () => ipcRenderer.invoke("stock:getProducts"),
    add: (productId, quantity, note) => ipcRenderer.invoke("stock:add", productId, quantity, note),
    adjust: (productId, quantity, reason, note) => ipcRenderer.invoke("stock:adjust", productId, quantity, reason, note),
    getMovements: () => ipcRenderer.invoke("stock:getMovements"),
  },

  dashboard: {
    getStats: () => ipcRenderer.invoke("dashboard:getStats"),
    getOverview: () => ipcRenderer.invoke("dashboard:getOverview"),
  },

  reports: {
    getSummary: (filters) => ipcRenderer.invoke("reports:getSummary", filters),
  },

  backup: {
    getStatus: () => ipcRenderer.invoke("backup:getStatus"),
    create: () => ipcRenderer.invoke("backup:create"),
    getHistory: () => ipcRenderer.invoke("backup:getHistory"),
    selectFile: () => ipcRenderer.invoke("backup:selectFile"),
    restore: (backupPath) => ipcRenderer.invoke("backup:restore", backupPath),
    openFolder: () => ipcRenderer.invoke("backup:openFolder"),
  },

  settings: {
    getAll: () => ipcRenderer.invoke("settings:getAll"),
    update: (settings) => ipcRenderer.invoke("settings:update", settings),
    getSystemInfo: () => ipcRenderer.invoke("settings:getSystemInfo"),
  },
});
