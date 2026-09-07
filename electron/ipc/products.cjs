const { ipcMain } = require("electron");
const { getPrisma } = require("../services/database.cjs");

function normalizeProductData(data = {}) {
  const categoryId = data.categoryId == null || data.categoryId === "" ? null : Number(data.categoryId);

  return {
    name: String(data.name ?? "").trim(),
    categoryId,
    costPrice: Number(data.costPrice ?? 0),
    sellingPrice: Number(data.sellingPrice ?? 0),
    stockQty: Number(data.stockQty ?? 0),
    lowStockLevel: Number(data.lowStockLevel ?? 0),
  };
}

ipcMain.handle("products:getAll", async () => {
  return getPrisma().product.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
});

ipcMain.handle("products:create", async (_event, data) => {
  const prisma = getPrisma();
  const payload = normalizeProductData(data);

  if (!payload.name) {
    throw new Error("Product name is required.");
  }

  if (payload.costPrice < 0 || payload.sellingPrice < 0 || payload.stockQty < 0 || payload.lowStockLevel < 0) {
    throw new Error("Prices and quantities cannot be negative.");
  }

  return prisma.product.create({
    data: payload,
    include: { category: true },
  });
});

ipcMain.handle("products:update", async (_event, id, data) => {
  const prisma = getPrisma();
  const payload = normalizeProductData(data);

  if (!payload.name) {
    throw new Error("Product name is required.");
  }

  if (payload.costPrice < 0 || payload.sellingPrice < 0 || payload.stockQty < 0 || payload.lowStockLevel < 0) {
    throw new Error("Prices and quantities cannot be negative.");
  }

  return prisma.product.update({
    where: { id: Number(id) },
    data: payload,
    include: { category: true },
  });
});

ipcMain.handle("products:delete", async (_event, id) => {
  const prisma = getPrisma();
  await prisma.product.delete({
    where: { id: Number(id) },
  });
});
