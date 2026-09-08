const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  products: {
    getAll: () => ipcRenderer.invoke("products:getAll"),
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

  orders: {
    getAll: () => ipcRenderer.invoke("orders:getAll"),
    getById: (id) => ipcRenderer.invoke("orders:getById", id),
    create: (data) => ipcRenderer.invoke("orders:create", data),
    update: (id, data) => ipcRenderer.invoke("orders:update", id, data),
    updateStatus: (id, status) => ipcRenderer.invoke("orders:updateStatus", id, status),
    updatePaymentStatus: (id, status) => ipcRenderer.invoke("orders:updatePaymentStatus", id, status),
    delete: (id) => ipcRenderer.invoke("orders:delete", id),
  },

  dashboard: {
    getStats: () => ipcRenderer.invoke("dashboard:getStats"),
    getOverview: () => ipcRenderer.invoke("dashboard:getOverview"),
  },
});
