const { ipcMain } = require("electron");
const { getPrisma } = require("../services/database.cjs");

async function ensureSaleItemSnapshotColumns(prisma) {
  const columns = await prisma.$queryRawUnsafe("PRAGMA table_info('SaleItem');");
  const columnNames = columns.map((column) => column.name);

  if (!columnNames.includes("productName")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "SaleItem" ADD COLUMN "productName" TEXT NOT NULL DEFAULT "";');
  }
  if (!columnNames.includes("costPrice")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "SaleItem" ADD COLUMN "costPrice" INTEGER NOT NULL DEFAULT 0;');
  }
  if (!columnNames.includes("profit")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "SaleItem" ADD COLUMN "profit" INTEGER NOT NULL DEFAULT 0;');
  }
}

function toSafeNumber(value, fieldName) {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return num;
}

ipcMain.handle("sales:create", async (_event, payload = {}) => {
  const prisma = getPrisma();
  await ensureSaleItemSnapshotColumns(prisma);
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  if (!rawItems.length) {
    throw new Error("The cart is empty.");
  }

  const cashReceived = toSafeNumber(payload.cashReceived, "Cash received");
  if (cashReceived < 0) {
    throw new Error("Cash received cannot be negative.");
  }

  return prisma.$transaction(async (tx) => {
    const normalizedItems = [];

    for (const item of rawItems) {
      const productId = Number(item.productId);
      const quantity = toSafeNumber(item.quantity, "Quantity");
      const unitPrice = toSafeNumber(item.unitPrice, "Unit price");
      const costPrice = toSafeNumber(item.costPrice ?? 0, "Cost price");

      if (!productId || productId <= 0) {
        throw new Error("A product in the cart is invalid.");
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("Quantity must be at least 1.");
      }
      if (unitPrice < 0 || costPrice < 0) {
        throw new Error("Prices cannot be negative.");
      }

      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error("One or more products are no longer available.");
      }
      if (quantity > product.stockQty) {
        throw new Error(`${product.name} only has ${product.stockQty} item(s) left in stock.`);
      }

      const subtotal = quantity * unitPrice;
      normalizedItems.push({
        productId,
        productName: product.name,
        quantity,
        unitPrice,
        costPrice,
        subtotal,
        profit: (unitPrice - costPrice) * quantity,
      });
    }

    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);

    if (cashReceived < totalAmount) {
      throw new Error("Cash received is less than the total sale amount.");
    }

    const sale = await tx.sale.create({
      data: {
        totalAmount,
        cashReceived,
        changeAmount: cashReceived - totalAmount,
        items: {
          create: normalizedItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice,
            subtotal: item.subtotal,
            profit: item.profit,
          })),
        },
      },
    });

    for (const item of normalizedItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { decrement: item.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "SALE",
          quantity: -item.quantity,
          note: `Sale #${sale.id}`,
        },
      });
    }

    return {
      success: true,
      saleId: sale.id,
      totalAmount: sale.totalAmount,
      changeAmount: sale.changeAmount,
    };
  });
});
