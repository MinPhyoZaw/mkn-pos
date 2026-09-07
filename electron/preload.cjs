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
});
