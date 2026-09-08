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
  const prisma = getPrisma();

  return prisma.product.findMany({
    include: {
      category: true,
    },
    orderBy: {
      name: "asc",
    },
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
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) throw new Error("A valid product ID is required.");

  const [sales, orders, movements] = await Promise.all([
    prisma.saleItem.count({ where: { productId } }),
    prisma.orderItem.count({ where: { productId } }),
    prisma.stockMovement.count({ where: { productId } }),
  ]);
  if (sales || orders || movements) {
    throw new Error("This product has existing sales, order, or stock history and cannot be permanently deleted.");
  }

  try {
    return await prisma.product.delete({ where: { id: productId } });
  } catch (error) {
    if (error?.code === "P2003") {
      throw new Error("This product has existing sales, order, or stock history and cannot be permanently deleted.");
    }
    if (error?.code === "P2025") throw new Error("Product not found.");
    throw error;
  }
});
