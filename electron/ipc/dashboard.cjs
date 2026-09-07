const { ipcMain } = require("electron");
const { getPrisma } = require("../services/database.cjs");

ipcMain.handle("dashboard:getStats", async () => {
  const prisma = getPrisma();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [sales, totalOrders, totalProducts, products] = await Promise.all([
    prisma.sale.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: start, lt: end }, status: "COMPLETED" } }),
    prisma.order.count(),
    prisma.product.count(),
    prisma.product.findMany({ select: { stockQty: true, lowStockLevel: true } }),
  ]);

  return {
    todaySales: sales._sum.totalAmount ?? 0,
    totalOrders,
    totalProducts,
    lowStockItems: products.filter((product) => product.stockQty <= product.lowStockLevel).length,
  };
});
