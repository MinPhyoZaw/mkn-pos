const { ipcMain } = require("electron");
const { getPrisma } = require("../services/database.cjs");

const toLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

ipcMain.handle("dashboard:getStats", async () => {
  const prisma = getPrisma();
  const start = startOfDay(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [sales, totalOrders, totalProducts, products, recentSales] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { totalAmount: true },
      where: { createdAt: { gte: start, lt: end }, status: "COMPLETED" },
    }),
    prisma.order.count(),
    prisma.product.count(),
    prisma.product.findMany({ select: { stockQty: true, lowStockLevel: true } }),
    prisma.sale.findMany({
      where: { status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: true },
    }),
  ]);

  const formattedRecentSales = recentSales.map((sale) => ({
    id: sale.id,
    totalAmount: Number(sale.totalAmount),
    createdAt: sale.createdAt.toISOString(),
    itemCount: sale.items.reduce((sum, item) => sum + Number(item.quantity), 0),
  }));

  return {
    todaySales: sales._sum.totalAmount ?? 0,
    totalOrders,
    totalProducts,
    lowStockItems: products.filter((product) => product.stockQty <= product.lowStockLevel).length,
    recentSales: formattedRecentSales,
  };
});

ipcMain.handle("dashboard:getOverview", async () => {
  const prisma = getPrisma();
  const today = startOfDay(new Date());
  const daySevenStart = new Date(today);
  daySevenStart.setDate(today.getDate() - 6);

  const monthStart = startOfMonth(today);

  const [completedSales, monthSalesRows] = await Promise.all([
    prisma.sale.findMany({
      where: { status: "COMPLETED", createdAt: { gte: daySevenStart, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } },
      include: { items: true },
    }),
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: monthStart },
      },
      include: { items: true },
    }),
  ]);

  const todaySales = completedSales
    .filter((sale) => {
      const createdAt = new Date(sale.createdAt);
      return createdAt >= today && createdAt < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    })
    .reduce((sum, sale) => sum + Number(sale.totalAmount), 0);

  const last7DaysSales = completedSales
    .filter((sale) => {
      const createdAt = new Date(sale.createdAt);
      return createdAt >= daySevenStart && createdAt < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    })
    .reduce((sum, sale) => sum + Number(sale.totalAmount), 0);

  const monthSales = monthSalesRows.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);

  const todayGrossProfit = completedSales
    .filter((sale) => {
      const createdAt = new Date(sale.createdAt);
      return createdAt >= today && createdAt < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    })
    .reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.profit || 0), 0), 0);

  const grossProfit = monthSalesRows.reduce((sum, sale) => {
    const profitForSale = sale.items.reduce((itemSum, item) => itemSum + Number(item.profit || 0), 0);
    return sum + profitForSale;
  }, 0);

  const dailySales = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const dateStart = startOfDay(date);
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateStart.getDate() + 1);

    const total = completedSales
      .filter((sale) => {
        const createdAt = new Date(sale.createdAt);
        return createdAt >= dateStart && createdAt < dateEnd;
      })
      .reduce((sum, sale) => sum + Number(sale.totalAmount), 0);

    dailySales.push({
      date: toLocalDateKey(dateStart),
      label: dateStart.toLocaleDateString("en-US", { weekday: "short" }),
      total,
    });
  }

  return {
    todaySales,
    todayGrossProfit,
    last7DaysSales,
    monthSales,
    grossProfit,
    dailySales,
  };
});
