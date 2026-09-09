const { ipcMain } = require("electron");
const { getPrisma } = require("../services/database.cjs");

const PRESETS = new Set(["TODAY", "LAST_7_DAYS", "THIS_MONTH", "ALL_TIME", "CUSTOM"]);

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}

function localDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Report date is invalid.");
  return date;
}

function getRange(filters = {}) {
  const preset = String(filters.preset ?? "THIS_MONTH").toUpperCase();
  if (!PRESETS.has(preset)) throw new Error("Invalid report date range.");
  const today = startOfDay(new Date());

  if (preset === "ALL_TIME") return { start: null, end: null };
  if (preset === "CUSTOM") {
    if (!filters.startDate || !filters.endDate) throw new Error("Start and end dates are required.");
    const start = localDate(filters.startDate);
    const end = endOfDay(localDate(filters.endDate));
    if (end <= start) throw new Error("End date must be on or after the start date.");
    return { start, end };
  }

  const start = new Date(today);
  if (preset === "LAST_7_DAYS") start.setDate(start.getDate() - 6);
  if (preset === "THIS_MONTH") start.setDate(1);
  return { start, end: endOfDay(today) };
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

ipcMain.handle("reports:getSummary", async (_event, filters = {}) => {
  const prisma = getPrisma();
  const { start, end } = getRange(filters);
  const createdAt = start || end ? { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) } : undefined;
  const completedSales = await prisma.sale.findMany({
    where: { status: "COMPLETED", ...(createdAt ? { createdAt } : {}) },
    include: { items: { include: { product: { include: { category: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const summary = completedSales.reduce((result, sale) => {
    result.totalSales += Number(sale.totalAmount);
    result.transactions += 1;
    for (const item of sale.items) {
      result.itemsSold += Number(item.quantity);
      result.grossProfit += Number(item.profit ?? 0);
    }
    return result;
  }, { totalSales: 0, grossProfit: 0, transactions: 0, itemsSold: 0 });

  const trendStart = start || (completedSales.length ? startOfDay(completedSales[0].createdAt) : startOfDay(new Date()));
  const trendEnd = end || (completedSales.length ? endOfDay(completedSales[completedSales.length - 1].createdAt) : endOfDay(new Date()));
  const trendMap = new Map();
  for (const sale of completedSales) {
    const key = dateKey(new Date(sale.createdAt));
    trendMap.set(key, (trendMap.get(key) || 0) + Number(sale.totalAmount));
  }
  const salesTrend = [];
  for (const cursor = new Date(trendStart); cursor < trendEnd; cursor.setDate(cursor.getDate() + 1)) {
    const key = dateKey(cursor);
    salesTrend.push({ date: key, label: cursor.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), total: trendMap.get(key) || 0 });
  }

  const productMap = new Map();
  const sourceMap = new Map();
  const categoryMap = new Map();
  for (const sale of completedSales) {
    const source = sale.source === "ORDER" ? "ORDER" : "POS";
    sourceMap.set(source, (sourceMap.get(source) || 0) + Number(sale.totalAmount));
    for (const item of sale.items) {
      const product = productMap.get(item.productName) || { productName: item.productName, quantitySold: 0, revenue: 0, grossProfit: 0 };
      product.quantitySold += Number(item.quantity);
      product.revenue += Number(item.subtotal);
      product.grossProfit += Number(item.profit ?? 0);
      productMap.set(item.productName, product);

      const categoryName = item.product.category?.name || "Uncategorized";
      const category = categoryMap.get(categoryName) || { categoryName, quantitySold: 0, revenue: 0, grossProfit: 0 };
      category.quantitySold += Number(item.quantity);
      category.revenue += Number(item.subtotal);
      category.grossProfit += Number(item.profit ?? 0);
      categoryMap.set(categoryName, category);
    }
  }

  const orderWhere = createdAt ? { createdAt } : {};
  const [paidOrders, unpaidOrders, products] = await Promise.all([
    prisma.order.count({ where: { ...orderWhere, paymentStatus: "PAID" } }),
    prisma.order.count({ where: { ...orderWhere, paymentStatus: "UNPAID" } }),
    prisma.product.findMany({ select: { stockQty: true } }),
  ]);

  return {
    summary,
    salesTrend,
    topProducts: [...productMap.values()].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 10),
    sourceBreakdown: [...sourceMap.entries()].map(([source, total]) => ({ source, total })),
    categoryPerformance: [...categoryMap.values()].sort((a, b) => b.revenue - a.revenue),
    orderPaymentSummary: { paidOrders, unpaidOrders },
    stockSummary: {
      lowStockItems: products.filter((product) => product.stockQty > 0 && product.stockQty <= 5).length,
      outOfStockItems: products.filter((product) => product.stockQty <= 0).length,
    },
  };
});
