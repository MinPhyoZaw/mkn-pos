const { ipcMain } = require("electron");
const { getPrisma } = require("../services/database.cjs");
const { readSettings } = require("./settings.cjs");

const PAYMENT_STATUSES = new Set(["UNPAID", "PAID"]);
const ORDER_STATUSES = new Set(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]);

function numericId(value, label = "ID") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`${label} must be a positive number.`);
  return id;
}

function normalizeOrder(data = {}) {
  const customerName = String(data.customerName ?? "").trim();
  const phone = String(data.phone ?? "").trim();
  const address = String(data.address ?? "").trim();
  const notes = String(data.notes ?? "").trim() || null;
  const paymentStatus = String(data.paymentStatus ?? "UNPAID").toUpperCase();
  const status = String(data.status ?? "PENDING").toUpperCase();
  const orderDate = new Date(data.orderDate ?? Date.now());
  const items = Array.isArray(data.items) ? data.items.map((item) => {
    const productId = item.productId == null ? null : numericId(item.productId, "Product ID");
    const productName = String(item.productName ?? "").trim();
    const unitPrice = Number(item.unitPrice);
    const quantity = Number(item.quantity);
    if (!productName) throw new Error("Every order item needs a product name.");
    if (!Number.isInteger(unitPrice) || unitPrice < 0) throw new Error(`Unit price for ${productName} must be a non-negative whole number.`);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Quantity for ${productName} must be greater than zero.`);
    return { productId, productName, unitPrice, quantity, subtotal: unitPrice * quantity };
  }) : [];

  if (!customerName) throw new Error("Customer name is required.");
  if (!phone) throw new Error("Phone number is required.");
  if (!address) throw new Error("Address is required.");
  if (!items.length) throw new Error("Add at least one product to the order.");
  if (!PAYMENT_STATUSES.has(paymentStatus)) throw new Error("Invalid payment status.");
  if (!ORDER_STATUSES.has(status)) throw new Error("Invalid order status.");
  if (status === "COMPLETED") throw new Error("Complete an order from its status control so stock and sales are updated together.");
  if (Number.isNaN(orderDate.getTime())) throw new Error("Order date is invalid.");

  return { customerName, phone, address, notes, paymentStatus, status, orderDate, items };
}

async function ensureProductsExist(tx, items) {
  const ids = [...new Set(items.map((item) => item.productId).filter((id) => id !== null))];
  if (!ids.length) return;
  const count = await tx.product.count({ where: { id: { in: ids } } });
  if (count !== ids.length) throw new Error("One or more selected products no longer exist. Refresh the product list and try again.");
}

const includeItems = { items: { orderBy: { id: "asc" } } };

ipcMain.handle("orders:getAll", () => getPrisma().order.findMany({
  include: includeItems,
  orderBy: [{ orderDate: "desc" }, { id: "desc" }],
}));

ipcMain.handle("orders:getById", async (_event, id) => {
  const order = await getPrisma().order.findUnique({ where: { id: numericId(id, "Order ID") }, include: includeItems });
  if (!order) throw new Error("Order not found.");
  return order;
});

ipcMain.handle("orders:create", async (_event, data) => {
  const payload = normalizeOrder(data);
  return getPrisma().$transaction(async (tx) => {
    await ensureProductsExist(tx, payload.items);
    return tx.order.create({
      data: {
        customerName: payload.customerName, phone: payload.phone, address: payload.address,
        notes: payload.notes, paymentStatus: payload.paymentStatus, status: payload.status,
        orderDate: payload.orderDate,
        totalAmount: payload.items.reduce((sum, item) => sum + item.subtotal, 0),
        items: { create: payload.items },
      },
      include: includeItems,
    });
  });
});

ipcMain.handle("orders:update", async (_event, id, data) => {
  const orderId = numericId(id, "Order ID");
  const payload = normalizeOrder(data);
  return getPrisma().$transaction(async (tx) => {
    await ensureProductsExist(tx, payload.items);
    await tx.orderItem.deleteMany({ where: { orderId } });
    return tx.order.update({
      where: { id: orderId },
      data: {
        customerName: payload.customerName, phone: payload.phone, address: payload.address,
        notes: payload.notes, paymentStatus: payload.paymentStatus, status: payload.status,
        orderDate: payload.orderDate,
        totalAmount: payload.items.reduce((sum, item) => sum + item.subtotal, 0),
        items: { create: payload.items },
      },
      include: includeItems,
    });
  });
});

ipcMain.handle("orders:updateStatus", async (_event, id, status) => {
  const value = String(status ?? "").toUpperCase();
  if (!ORDER_STATUSES.has(value)) throw new Error("Invalid order status.");
  const orderId = numericId(id, "Order ID");

  if (value !== "COMPLETED") {
    return getPrisma().order.update({ where: { id: orderId }, data: { status: value }, include: includeItems });
  }

  return getPrisma().$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: includeItems });
    if (!order) throw new Error("Order not found.");
    if (order.saleId) return order;
    if (order.paymentStatus !== "PAID" && !(await readSettings(tx)).allowUnpaidOrderCompletion) {
      throw new Error("Please mark this order as paid before completing it.");
    }

    const quantities = new Map();
    for (const item of order.items) {
      if (!item.productId) throw new Error(`Cannot complete order. ${item.productName} is no longer linked to a product.`);
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }

    const products = new Map();
    for (const [productId, quantity] of quantities) {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error(`Cannot complete order. Product #${productId} is no longer available.`);
      if (product.stockQty < quantity) {
        throw new Error(`Cannot complete order. ${product.name} only has ${product.stockQty} item(s) in stock, but this order requires ${quantity}.`);
      }
      products.set(productId, product);
    }

    const sale = await tx.sale.create({
      data: {
        totalAmount: order.totalAmount,
        cashReceived: order.paymentStatus === "PAID" ? order.totalAmount : 0,
        changeAmount: 0,
        source: "ORDER",
        items: {
          create: order.items.map((item) => {
            const product = products.get(item.productId);
            const costPrice = product.costPrice;
            return {
              productId: item.productId,
              productName: product.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              costPrice,
              subtotal: item.subtotal,
              profit: (item.unitPrice - costPrice) * item.quantity,
            };
          }),
        },
      },
    });

    for (const [productId, quantity] of quantities) {
      await tx.product.update({ where: { id: productId }, data: { stockQty: { decrement: quantity } } });
      await tx.stockMovement.create({
        data: { productId, type: "ORDER_SALE", quantity: -quantity, note: `Completed Order #${order.id}` },
      });
    }

    return tx.order.update({
      where: { id: order.id },
      data: { status: "COMPLETED", saleId: sale.id },
      include: includeItems,
    });
  });
});

ipcMain.handle("orders:updatePaymentStatus", (_event, id, status) => {
  const value = String(status ?? "").toUpperCase();
  if (!PAYMENT_STATUSES.has(value)) throw new Error("Invalid payment status.");
  return getPrisma().order.update({ where: { id: numericId(id, "Order ID") }, data: { paymentStatus: value }, include: includeItems });
});

ipcMain.handle("orders:delete", (_event, id) => getPrisma().order.delete({ where: { id: numericId(id, "Order ID") } }));

