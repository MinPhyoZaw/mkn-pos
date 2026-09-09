const { ipcMain } = require("electron");
const { getPrisma } = require("../services/database.cjs");

const SALE_STATUSES = new Set(["COMPLETED", "CANCELLED"]);
const SALE_SOURCES = new Set(["POS", "ORDER"]);

function saleId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Sale ID must be a positive number.");
  return id;
}

function dateValue(value) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Date filter is invalid.");
  return date;
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

  const from = dateValue(filters.from);
  const to = dateValue(filters.to);
  const saleNumber = String(filters.search ?? "").trim();
  const where = {
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(saleNumber ? { id: Number.isInteger(Number(saleNumber)) ? Number(saleNumber) : -1 } : {}),
  };

  const sales = await getPrisma().sale.findMany({ where, orderBy: { createdAt: "desc" }, include: includeItems });
  return sales.map(serializeSale);
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
