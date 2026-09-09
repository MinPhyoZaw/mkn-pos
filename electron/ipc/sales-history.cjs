const { ipcMain } = require("electron");
const { getPrisma } = require("../services/database.cjs");

const SALE_STATUSES = new Set(["COMPLETED", "CANCELLED"]);
const SALE_SOURCES = new Set(["POS", "ORDER"]);

function saleId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Sale ID must be a positive number.");
  return id;
}

function localDateValue(value) {
  if (!value) return undefined;
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Date filter is invalid.");
  return date;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function nextDay(date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}

function dateRange(filters = {}) {
  const filterType = String(filters.filterType ?? "all").toLowerCase().replaceAll("_", "");
  const now = new Date();
  if (filterType === "today") return { gte: startOfDay(now), lt: nextDay(now) };
  if (filterType === "last7days") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 6);
    return { gte: start, lt: nextDay(now) };
  }
  if (filterType === "thismonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { gte: start, lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }
  if (filterType === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(String(filters.month ?? ""));
    if (!match) throw new Error("Month filter is invalid.");
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    return { gte: new Date(year, month, 1), lt: new Date(year, month + 1, 1) };
  }
  if (filterType === "custom") {
    const start = localDateValue(filters.fromDate);
    const end = localDateValue(filters.toDate);
    if (!start || !end) throw new Error("Both custom dates are required.");
    if (nextDay(end) <= start) throw new Error("The end date must be on or after the start date.");
    return { gte: startOfDay(start), lt: nextDay(end) };
  }
  return undefined;
}

function serializeSale(sale) {
  return {
    id: sale.id,
    createdAt: sale.createdAt.toISOString(),
    totalAmount: Number(sale.totalAmount),
    cashReceived: Number(sale.cashReceived),
    changeAmount: Number(sale.changeAmount),
    status: sale.status === "CANCELLED" ? "CANCELLED" : "COMPLETED",
    source: sale.source === "ORDER" ? "ORDER" : "POS",
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      costPrice: Number(item.costPrice),
      subtotal: Number(item.subtotal),
      profit: Number(item.profit ?? 0),
    })),
    itemCount: sale.items.length,
    totalQuantity: sale.items.reduce((sum, item) => sum + Number(item.quantity), 0),
    grossProfit: sale.items.reduce((sum, item) => sum + Number(item.profit ?? 0), 0),
  };
}

const includeItems = { items: { orderBy: { id: "asc" } } };

ipcMain.handle("salesHistory:getAll", async (_event, filters = {}) => {
  const status = filters.status && filters.status !== "ALL" ? String(filters.status).toUpperCase() : undefined;
  const source = filters.source && filters.source !== "ALL" ? String(filters.source).toUpperCase() : undefined;
  if (status && !SALE_STATUSES.has(status)) throw new Error("Invalid sale status filter.");
  if (source && !SALE_SOURCES.has(source)) throw new Error("Invalid sale source filter.");

  const createdAt = dateRange(filters) || (filters.from || filters.to ? {
    ...(filters.from ? { gte: localDateValue(filters.from) } : {}),
    ...(filters.to ? { lt: localDateValue(filters.to) } : {}),
  } : undefined);
  const saleNumber = String(filters.search ?? "").trim();
  const where = {
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(saleNumber ? { id: Number.isInteger(Number(saleNumber)) ? Number(saleNumber) : -1 } : {}),
  };

  const sales = await getPrisma().sale.findMany({ where, orderBy: { createdAt: "desc" }, include: includeItems });
  const rows = sales.map(serializeSale);
  const completed = rows.filter((sale) => sale.status === "COMPLETED");
  return {
    sales: rows,
    summary: {
      totalSales: completed.reduce((sum, sale) => sum + sale.totalAmount, 0),
      grossProfit: completed.reduce((sum, sale) => sum + sale.grossProfit, 0),
      transactions: completed.length,
      itemsSold: completed.reduce((sum, sale) => sum + sale.totalQuantity, 0),
    },
  };
});

ipcMain.handle("salesHistory:getById", async (_event, id) => {
  const sale = await getPrisma().sale.findUnique({ where: { id: saleId(id) }, include: includeItems });
  if (!sale) throw new Error("Sale not found.");
  return serializeSale(sale);
});

ipcMain.handle("salesHistory:voidSale", async (_event, id) => {
  const targetId = saleId(id);
  return getPrisma().$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: targetId }, include: includeItems });
    if (!sale) throw new Error("Sale not found.");
    if (sale.status === "CANCELLED") return serializeSale(sale);

    for (const item of sale.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { increment: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "SALE_VOID",
          quantity: item.quantity,
          note: `Void Sale #${sale.id}`,
        },
      });
    }

    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: { status: "CANCELLED" },
      include: includeItems,
    });
    return serializeSale(updated);
  });
});
