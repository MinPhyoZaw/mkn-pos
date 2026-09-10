"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  ClipboardList,
  Package,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";

import AppShell from "@/components/layout/AppShell";

type RecentSale = {
  id: number;
  totalAmount: number;
  createdAt: string;
  itemCount: number;
};

type DailySale = {
  date: string;
  label: string;
  total: number;
};

type SalesOverview = {
  todaySales: number;
  todayGrossProfit: number;
  last7DaysSales: number;
  monthSales: number;
  grossProfit: number;
  dailySales: DailySale[];
};

const initial = {
  todaySales: 0,
  totalOrders: 0,
  totalProducts: 0,
  lowStockItems: 0,
};

const overviewInitial: SalesOverview = {
  todaySales: 0,
  todayGrossProfit: 0,
  last7DaysSales: 0,
  monthSales: 0,
  grossProfit: 0,
  dailySales: [],
};

const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ကျပ်`;

const formatDayLabel = () =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

const formatSaleDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export default function DashboardPage() {
  const [stats, setStats] = useState(initial);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [salesOverview, setSalesOverview] = useState<SalesOverview>(overviewInitial);

  const [lowStockProducts, setLowStockProducts] = useState<
    Array<{
      id: number;
      name: string;
      stockQty: number;
      lowStockLevel: number;
    }>
  >([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const electronApi =
        typeof window !== "undefined"
          ? (window as any).electron
          : undefined;

      if (!electronApi) {
        if (active) {
          setStats(initial);
          setRecentSales([]);
          setLowStockProducts([]);
        }

        return;
      }

      try {
        const [dashboardStats, overviewStats, productRows] = await Promise.all([
          electronApi.dashboard?.getStats?.() ??
            Promise.resolve(initial),
          electronApi.dashboard?.getOverview?.() ??
            Promise.resolve(overviewInitial),
          electronApi.products?.getAll?.() ??
            Promise.resolve([]),
        ]);

        if (!active) return;

        const statsFromApi = dashboardStats ?? initial;
        setStats(statsFromApi);
        setRecentSales(statsFromApi?.recentSales ?? []);
        setSalesOverview(overviewStats ?? overviewInitial);

        setLowStockProducts(
          (productRows ?? [])
            .filter(
              (product: any) =>
                Number(product.stockQty) <=
                Number(product.lowStockLevel),
            )
            .sort(
              (a: any, b: any) =>
                Number(a.stockQty) -
                Number(b.stockQty),
            )
            .slice(0, 5),
        );
      } catch (error) {
        console.error("Failed to load dashboard:", error);

        if (active) {
          setStats(initial);
          setRecentSales([]);
          setSalesOverview(overviewInitial);
          setLowStockProducts([]);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const cards = [
    {
      label: "ယနေ့ရောင်းရငွေ",
      value: money(stats.todaySales),
      description: "Sales recorded today",
      icon: Banknote,

      cardBg: "#f0fdf4",
      borderColor: "#bbf7d0",

      iconBg: "#dcfce7",
      iconColor: "#15803d",

      valueColor: "#667085",
    },

    {
      label: "အော်ဒါ",
      value: String(stats.totalOrders),
      description: "All orders in the system",
      icon: ClipboardList,

      cardBg: "#ECFEFF",
      borderColor: "#D9EEEA",

      iconBg: "#ECFEFF",
      iconColor: "#0F766E",

      valueColor: "#0F766E",
    },

    {
      label: "ကုန်ပစ္စည်းများ",
      value: String(stats.totalProducts),
      description: "Available inventory items",
      icon: Package,

      cardBg: "#F0FDFA",
      borderColor: "#D9EEEA",

      iconBg: "#CCFBF1",
      iconColor: "#0F766E",

      valueColor: "#0F766E",
    },

    {
      label: "လက်ကျန်နည်းနေသော ကုန်ပစ္စည်းများ",
      value: String(stats.lowStockItems),
      description: "Items below reorder level",
      icon: TriangleAlert,

      cardBg: "#fff7ed",
      borderColor: "#fed7aa",

      iconBg: "#ffedd5",
      iconColor: "#ea580c",

      valueColor: "#c2410c",
    },
  ];

  const pageStyle: React.CSSProperties = {
    background: "#f8fafc",
    minHeight: "100%",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "28px",
  };

  const titleStyle: React.CSSProperties = {
    margin: "0 0 6px",
    fontSize: "2.2rem",
    lineHeight: 1.15,
    fontWeight: 800,
    color: "#134E4A",
  };

  const subtitleStyle: React.CSSProperties = {
    margin: 0,
    color: "#475467",
    fontSize: "1rem",
  };

  const dateBadgeStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "999px",
    padding: "10px 14px",
    color: "#475467",
    fontSize: "0.85rem",
    fontWeight: 600,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  };

  const salesButtonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",

    background: "#0F766E",
    color: "#ffffff",

    padding: "12px 18px",
    borderRadius: "12px",

    fontWeight: 700,
    textDecoration: "none",

    boxShadow:
      "0 4px 12px rgba(37, 99, 235, 0.18)",

    border: "1px solid transparent",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",

    gap: "16px",
    marginBottom: "20px",
  };

  const cardBaseStyle: React.CSSProperties = {
    borderRadius: "18px",
    boxShadow:
      "0 4px 14px rgba(15, 23, 42, 0.04)",

    padding: "20px",

    transition:
      "transform 0.2s ease, box-shadow 0.2s ease",
  };

  const sectionStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1.35fr 1fr",
    gap: "16px",
    marginBottom: "20px",
  };

  const sectionBaseStyle: React.CSSProperties = {
    borderRadius: "18px",
    padding: "22px",
    minHeight: "250px",

    boxShadow:
      "0 4px 14px rgba(15, 23, 42, 0.04)",
  };

  const maxChartValue = Math.max(
    1,
    ...salesOverview.dailySales.map((item) => Number(item.total || 0)),
  );

  const emptyStateStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",

    minHeight: "180px",

    textAlign: "center",
    color: "#64748b",

    padding: "18px",
    gap: "8px",
  };

  return (
    <AppShell>
      <div style={pageStyle}>
        {/* HEADER */}

        <div style={headerStyle}>
          <div>
            <p
              style={{
                margin: 0,

                fontSize: "0.76rem",
                letterSpacing: "0.12em",

                fontWeight: 700,
                color: "#64748b",

                textTransform: "uppercase",
              }}
            >
              Overview
            </p>

            <h1 style={titleStyle}>
              Dashboard
            </h1>

            <p style={subtitleStyle}>
              Here’s a quick overview of your shop
              today.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div style={dateBadgeStyle}>
              {formatDayLabel()}
            </div>

            <a
              href="/sales"
              style={salesButtonStyle}
            >
              <ShoppingCart size={18} />

              <span>ရောင်းမည်</span>
            </a>
          </div>
        </div>

        {/* SUMMARY CARDS */}

        <section style={gridStyle}>
          {cards.map(
            ({
              label,
              value,
              description,
              icon: Icon,

              cardBg,
              borderColor,

              iconBg,
              iconColor,

              valueColor,
            }) => (
              <div
                key={label}
                style={{
                  ...cardBaseStyle,

                  background: cardBg,

                  border: `1px solid ${borderColor}`,
                }}
              >
                <div
                  style={{
                    display: "flex",

                    alignItems: "flex-start",

                    justifyContent:
                      "space-between",

                    gap: "12px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        margin: 0,

                        fontSize: "0.86rem",

                        fontWeight: 600,

                        color: "#64748b",
                      }}
                    >
                      {label}
                    </p>

                    <h3
                      style={{
                        margin:
                          "12px 0 0",

                        fontSize: "2rem",

                        lineHeight: 1.15,

                        fontWeight: 800,

                        color: valueColor,
                      }}
                    >
                      {value}
                    </h3>

                    <p
                      style={{
                        margin:
                          "10px 0 0",

                        fontSize:
                          "0.72rem",

                        color: "#64748b",
                      }}
                    >
                      {description}
                    </p>
                  </div>

                  <div
                    style={{
                      display: "flex",

                      alignItems: "center",

                      justifyContent:
                        "center",

                      width: "46px",
                      height: "46px",

                      borderRadius:
                        "14px",

                      background:
                        iconBg,

                      flexShrink: 0,
                    }}
                  >
                    <Icon
                      size={21}
                      style={{
                        color:
                          iconColor,
                      }}
                    />
                  </div>
                </div>
              </div>
            ),
          )}
        </section>

        {/* SALES OVERVIEW + RECENT SALES */}

        <section style={sectionStyle}>
          {/* SALES OVERVIEW */}

          <div
            style={{
              ...sectionBaseStyle,

              background: "#f8fbff",

              border:
                "1px solid #D9EEEA",
            }}
          >
            <div
              style={{
                marginBottom: "18px",
              }}
            >
              <h3
                style={{
                  margin: 0,

                  fontSize:
                    "1.15rem",

                  fontWeight: 700,

                  color: "#1e3a8a",
                }}
              >
                အရောင်းအနှစ်ချုပ်
              </h3>

              <p
                style={{
                  margin:
                    "6px 0 0",

                  color: "#64748b",

                  fontSize:
                    "0.87rem",
                }}
              >
                Track your recent sales
                performance.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "10px",
                marginBottom: "18px",
              }}
            >
              {[
                { label: "ယနေ့ရောင်းရငွေ", value: salesOverview.todaySales },
                { label: "ယနေ့ အသားတင်အမြတ်", value: salesOverview.todayGrossProfit },
                { label: "တစ်ပတ်အတွင်း ရောင်းရငွေ", value: salesOverview.last7DaysSales },
                { label: "ယခုလ‌ ရောင်းရငွေ", value: salesOverview.monthSales },
                { label: "ယခုလ အသားတင်အမြတ် ", value: salesOverview.grossProfit },
              ].map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #dbeafe",
                    borderRadius: "12px",
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                    }}
                  >
                    {metric.label}
                  </div>
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "1rem",
                      fontWeight: 800,
                      color: "#667085",
                    }}
                  >
                    {money(metric.value)}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "end",
                justifyContent: "space-between",
                gap: "8px",
                minHeight: "120px",
                paddingTop: "12px",
              }}
            >
              {salesOverview.dailySales.length === 0 ? (
                <div style={emptyStateStyle}>
                  <p style={{ margin: 0, fontWeight: 700, color: "#334155" }}>No sales data yet.</p>
                  <p style={{ margin: 0, maxWidth: "360px", fontSize: "0.92rem", lineHeight: 1.6 }}>
                    Sales activity will appear here after you complete transactions.
                  </p>
                </div>
              ) : (
                salesOverview.dailySales.map((day) => (
                  <div
                    key={day.date}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "36px",
                        height: `${Math.max(12, (day.total / maxChartValue) * 100)}px`,
                        minHeight: "12px",
                        background: day.total > 0 ? "#0F766E" : "#D9EEEA",
                        borderRadius: "10px 10px 6px 6px",
                        boxShadow: day.total > 0 ? "0 4px 10px rgba(96, 165, 250, 0.3)" : "none",
                      }}
                    />
                    <div
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        color: "#64748b",
                      }}
                    >
                      {day.label}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RECENT SALES */}

          <div
            style={{
              ...sectionBaseStyle,

              background: "#faf8ff",

              border:
                "1px solid #D9EEEA",
            }}
          >
            <div
              style={{
                marginBottom: "18px",
              }}
            >
              <h3
                style={{
                  margin: 0,

                  fontSize:
                    "1.15rem",

                  fontWeight: 700,

                  color: "green",
                }}
              >
                နောက်ဆုံးရောင်းအားများ
              </h3>

              <p
                style={{
                  margin:
                    "6px 0 0",

                  color: "#64748b",

                  fontSize:
                    "0.87rem",
                }}
              >
                Latest completed
                transactions.
              </p>
            </div>

            {recentSales.length === 0 ? (
              <div style={emptyStateStyle}>
                <div
                  style={{
                    width: "50px",
                    height: "50px",

                    borderRadius:
                      "16px",

                    display: "flex",

                    alignItems:
                      "center",

                    justifyContent:
                      "center",

                    background:
                      "#ECFEFF",
                  }}
                >
                  <ShoppingCart
                    size={22}
                    style={{
                      color:
                        "#0F766E",
                    }}
                  />
                </div>

                <p
                  style={{
                    margin: 0,

                    fontSize:
                      "1.05rem",

                    fontWeight: 700,

                    color: "#334155",
                  }}
                >
                  No recent sales yet.
                </p>

                <p
                  style={{
                    margin: 0,

                    maxWidth:
                      "360px",

                    fontSize:
                      "0.92rem",

                    lineHeight: 1.6,
                  }}
                >
                  Completed sales will
                  appear here.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                }}
              >
                {recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      background: "#ffffff",
                      border: "1px solid #D9EEEA",
                      borderRadius: "12px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#134E4A",
                        }}
                      >
                        Sale #{sale.id}
                      </div>

                      <div
                        style={{
                          color: "#64748b",
                          fontSize: "0.8rem",
                          marginTop: "4px",
                        }}
                      >
                        {sale.itemCount} item{sale.itemCount === 1 ? "" : "s"} • {formatSaleDate(sale.createdAt)}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                        display: "grid",
                        gap: "4px",
                      }}
                    >
                      <strong
                        style={{
                          color: "#667085",
                          fontSize: "0.96rem",
                        }}
                      >
                        {money(sale.totalAmount)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* LOW STOCK */}

        {lowStockProducts.length >
          0 && (
          <section
            style={{
              ...sectionBaseStyle,

              minHeight: "auto",

              background:
                "#fffbeb",

              border:
                "1px solid #fde68a",
            }}
          >
            <div
              style={{
                display: "flex",

                alignItems:
                  "center",

                justifyContent:
                  "space-between",

                gap: "16px",

                marginBottom:
                  "18px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,

                    fontSize:
                      "1.15rem",

                    fontWeight: 700,

                    color:
                      "#92400e",
                  }}
                >
                  Low Stock
                </h3>

                <p
                  style={{
                    margin:
                      "6px 0 0",

                    color:
                      "#78716c",

                    fontSize:
                      "0.87rem",
                  }}
                >
                  Items that need
                  attention.
                </p>
              </div>

              <a
                href="/stock"
                style={{
                  color:
                    "#0F766E",

                  fontWeight: 600,

                  fontSize:
                    "0.88rem",

                  textDecoration:
                    "none",
                }}
              >
                View Stock
              </a>
            </div>

            <div
              style={{
                display: "grid",
                gap: "10px",
              }}
            >
              {lowStockProducts.map(
                (product) => (
                  <div
                    key={product.id}
                    style={{
                      display: "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "space-between",

                      gap: "12px",

                      padding:
                        "12px 14px",

                      background:
                        "#ffffff",

                      border:
                        "1px solid #fed7aa",

                      borderRadius:
                        "12px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight:
                            700,

                          color:
                            "#134E4A",
                        }}
                      >
                        {product.name}
                      </div>

                      <div
                        style={{
                          color:
                            "#64748b",

                          fontSize:
                            "0.82rem",

                          marginTop:
                            "2px",
                        }}
                      >
                        {
                          product.stockQty
                        }{" "}
                        remaining
                      </div>
                    </div>

                    <span
                      style={{
                        display:
                          "inline-flex",

                        alignItems:
                          "center",

                        gap: "5px",

                        background:
                          "#fff7ed",

                        border:
                          "1px solid #fdba74",

                        color:
                          "#c2410c",

                        borderRadius:
                          "999px",

                        padding:
                          "5px 9px",

                        fontSize:
                          "0.74rem",

                        fontWeight:
                          700,
                      }}
                    >
                      <TriangleAlert
                        size={13}
                      />

                      Low
                    </span>
                  </div>
                ),
              )}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}