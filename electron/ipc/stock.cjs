const { ipcMain } = require("electron");
const { getPrisma } = require("../services/database.cjs");

const ADJUSTMENT_REASONS = new Set(["Damaged", "Lost", "Correction", "Other"]);

function positiveId(value, label = "Product ID") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`${label} must be a positive number.`);
  return id;
}

function wholeNumber(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`${label} must be a whole number.`);
  return number;
}

function movementNote(note, fallback) {
  const value = String(note ?? "").trim();
  return value || fallback;
}

ipcMain.handle("stock:getProducts", () => getPrisma().product.findMany({
  include: { category: true },
  orderBy: { name: "asc" },
}));

ipcMain.handle("stock:getMovements", () => getPrisma().stockMovement.findMany({
  include: { product: true },
  orderBy: { createdAt: "desc" },
  take: 20,
}));

ipcMain.handle("stock:add", async (_event, productId, quantity, note) => {
  const id = positiveId(productId);
  const amount = wholeNumber(quantity, "Quantity");
  if (amount <= 0) throw new Error("Quantity to add must be greater than zero.");

  return getPrisma().$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id } });
    if (!product) throw new Error("Product not found.");

    const updated = await tx.product.update({
      where: { id },
      data: { stockQty: { increment: amount } },
      include: { category: true },
    });

    await tx.stockMovement.create({
      data: {
        productId: id,
        type: "STOCK_IN",
        quantity: amount,
        note: movementNote(note, "Stock added"),
      },
    });

    return updated;
  });
});

ipcMain.handle("stock:adjust", async (_event, productId, quantity, reason, note) => {
  const id = positiveId(productId);
  const amount = wholeNumber(quantity, "Adjustment");
  const adjustmentReason = String(reason ?? "").trim();
  if (!amount) throw new Error("Adjustment cannot be zero.");
  if (!ADJUSTMENT_REASONS.has(adjustmentReason)) throw new Error("Select a valid adjustment reason.");

  return getPrisma().$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id } });
    if (!product) throw new Error("Product not found.");
    if (product.stockQty + amount < 0) throw new Error("Stock cannot go below zero.");

    const updated = await tx.product.update({
      where: { id },
      data: { stockQty: { increment: amount } },
      include: { category: true },
    });

    const detail = String(note ?? "").trim();
    await tx.stockMovement.create({
      data: {
        productId: id,
        type: "ADJUSTMENT",
        quantity: amount,
        note: `${adjustmentReason} - ${detail || "Manual stock adjustment"}`,
      },
    });

    return updated;
  });
});
