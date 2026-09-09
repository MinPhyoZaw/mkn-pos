const { ipcMain } = require("electron");
const { getPrisma } = require("../services/database.cjs");
const { readSettings } = require("./settings.cjs");

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

function productSelect() {
  return { id: true, name: true, categoryId: true, costPrice: true, sellingPrice: true, stockQty: true, lowStockLevel: true, category: { select: { id: true, name: true } } };
}

function productWhere(filters = {}) {
  const search = String(filters.search ?? "").trim();
  const categoryId = filters.categoryId == null || filters.categoryId === "all" ? undefined : Number(filters.categoryId);
  const stockStatus = String(filters.stockStatus ?? "all").replace("low", "lowStock").replace("out", "outOfStock").replace("in", "inStock");
  const where = {
    ...(search ? { name: { contains: search } } : {}),
    ...(Number.isInteger(categoryId) ? { categoryId } : {}),
  };
  if (stockStatus === "outOfStock") where.stockQty = { lte: 0 };
  if (stockStatus === "inStock") where.stockQty = { gt: 0 };
  return where;
}

function normalizedProductWhere(filters = {}) {
  const where = productWhere(filters);
  if (String(filters.stockStatus ?? "all") === "lowStock") {
    delete where.AND;
    const search = String(filters.search ?? "").trim();
    const categoryId = filters.categoryId == null || filters.categoryId === "all" ? undefined : Number(filters.categoryId);
    return { search, categoryId };
  }
  return where;
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

ipcMain.handle("products:list", async (_event, filters = {}) => {
  const prisma = getPrisma();
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = [25, 50, 100].includes(Number(filters.pageSize)) ? Number(filters.pageSize) : 50;
  const base = normalizedProductWhere(filters);
  const stockStatus = String(filters.stockStatus ?? "all").replace("low", "lowStock").replace("out", "outOfStock").replace("in", "inStock");
  let where = base;
  if (stockStatus === "lowStock") {
    const candidates = await prisma.product.findMany({ where: base, select: { id: true, stockQty: true, lowStockLevel: true } });
    const ids = candidates.filter((product) => product.stockQty > 0 && product.stockQty <= product.lowStockLevel).map((product) => product.id);
    where = { id: { in: ids } };
  }
  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, select: productSelect(), orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where }),
  ]);
  return { products, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
});

ipcMain.handle("products:search", async (_event, filters = {}) => {
  const query = String(filters.query ?? "").trim();
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 30));
  return getPrisma().product.findMany({
    where: { stockQty: { gt: 0 }, ...(query ? { name: { contains: query } } : {}) },
    select: { id: true, name: true, sellingPrice: true, stockQty: true, lowStockLevel: true, categoryId: true, category: { select: { name: true } } },
    orderBy: { name: "asc" }, take: limit,
  });
});

ipcMain.handle("products:create", async (_event, data) => {
  const prisma = getPrisma();
  const payload = normalizeProductData(data);
  if (data?.lowStockLevel === undefined || data?.lowStockLevel === null || data?.lowStockLevel === "") {
    payload.lowStockLevel = (await readSettings(prisma)).defaultLowStockLevel;
  }

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
    data: { name: payload.name, categoryId: payload.categoryId, costPrice: payload.costPrice, sellingPrice: payload.sellingPrice, lowStockLevel: payload.lowStockLevel },
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
