'use client';

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import type { CartItem, Product } from "@/types/electron";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value) + " ကျပ်";

export default function Page() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cashReceived, setCashReceived] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProducts = async () => {
    const electronApi = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (!electronApi?.products?.search) {
      setProducts([]);
      return;
    }

    const rows = await electronApi.products.search({ query: search, limit: 30 });
    setProducts(rows.map((product) => ({ ...product, costPrice: 0, createdAt: "", updatedAt: "" } as Product)));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
    const refresh = async () => {
      setLoading(true);
      try {
        await loadProducts();
      } finally {
        setLoading(false);
      }
    };

    refresh();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filteredProducts = products;

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.subtotal, 0),
    [cart],
  );

  const numericCashReceived = cashReceived === "" ? 0 : Number(cashReceived);
  const changeAmount = Number.isFinite(numericCashReceived) && numericCashReceived >= 0 ? numericCashReceived - totalAmount : 0;

  const addToCart = (product: Product) => {
    setError("");
    setNotice("");

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);

      if (existing) {
        const nextQuantity = existing.quantity + 1;
        if (nextQuantity > product.stockQty) {
          setError(`Only ${product.stockQty} item(s) available for ${product.name}.`);
          return current;
        }

        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: nextQuantity, subtotal: nextQuantity * item.unitPrice }
            : item,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          unitPrice: product.sellingPrice,
          costPrice: product.costPrice,
          quantity: 1,
          availableStock: product.stockQty,
          subtotal: product.sellingPrice,
        },
      ];
    });
  };

  const adjustQuantity = (productId: number, change: number) => {
    setCart((current) => {
      return current.flatMap((item) => {
        if (item.productId !== productId) return [item];

        const nextQuantity = item.quantity + change;
        if (nextQuantity < 1) {
          return [];
        }

        if (nextQuantity > item.availableStock) {
          setError(`Only ${item.availableStock} item(s) available for ${item.productName}.`);
          return [item];
        }

        return [{ ...item, quantity: nextQuantity, subtotal: nextQuantity * item.unitPrice }];
      });
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((current) => current.filter((item) => item.productId !== productId));
    setError("");
  };

  const canCompleteSale =
    cart.length > 0 &&
    cashReceived !== "" &&
    Number(cashReceived) >= 0 &&
    Number(cashReceived) >= totalAmount;

  const handleCompleteSale = async () => {
    if (!canCompleteSale) {
      setError("Please enter a valid cash amount and ensure the cart is not empty.");
      return;
    }

    const electronApi = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (!electronApi?.sales?.create) {
      setError("Sale API is unavailable.");
      return;
    }

    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          subtotal: item.subtotal,
        })),
        totalAmount,
        cashReceived: Number(cashReceived),
        changeAmount: Number(cashReceived) - totalAmount,
      };

      const result = await electronApi.sales.create(payload);
      if (!result?.success) {
        throw new Error("Sale could not be completed.");
      }

      await loadProducts();
      setCart([]);
      setCashReceived("");
      setError("");
      setNotice(`Sale completed successfully. Sale #${result.saleId} • Total: ${money(result.totalAmount)} •: ${money(result.changeAmount)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to complete sale.";
      setError(message);
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>ကုန်ပစ္စည်းရောင်းချခြင်း</h1>
        </div>

        {notice ? <div style={noticeStyle}>{notice}</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 0.9fr", gap: 20 }}>
          <div style={panelStyle}>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ကုန်ပစ္စည်းရှာမည်..."
              style={inputStyle}
            />

            <div style={{ maxHeight: 620, overflowY: "auto", paddingRight: 8, scrollbarWidth: "thin", scrollbarColor: "#99d8d0 transparent" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 14, marginTop: 18 }}>
              {loading ? (
                <div style={{ gridColumn: "1 / -1", padding: 24, color: "#667085", textAlign: "center" }}>
                  Loading products...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", padding: 24, color: "#667085", textAlign: "center" }}>
                  No products available.
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    style={productCardStyle}
                    type="button"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, textAlign: "left" }}>{product.name}</div>
                      <span style={stockBadgeStyle}>Stock: {product.stockQty}</span>
                    </div>

                    <div style={{ color: "#475467", fontSize: 12, marginBottom: 8, textAlign: "left" }}>
                      {product.category?.name ?? "Uncategorized"}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="price-value" style={{ fontSize: 15, fontWeight: 700 }}>{money(product.sellingPrice)}</div>
                      <div style={{ fontSize: 12, color: "#0F766E", fontWeight: 700 }}> ထည့်မည်</div>
                    </div>
                  </button>
                ))
              )}
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>ဈေးခြင်းတောင်း</div>

            {cart.length === 0 ? (
              <div style={{ color: "#667085", padding: "18px 0" }}>ကုန်ပစ္စည်းမရှိသေးပါ</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {cart.map((item) => (
                  <div key={item.productId} style={cartItemStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 700 }}>{item.productName}</div>
                      <div className="price-value" style={{ fontWeight: 700 }}>{money(item.subtotal)}</div>
                    </div>

                    <div style={{ color: "#475467", fontSize: 13, marginTop: 4 }}>
                      <span className="price-value">{money(item.unitPrice)}</span> × {item.quantity}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button type="button" style={qtyButtonStyle} onClick={() => adjustQuantity(item.productId, -1)}>-</button>
                        <span style={{ minWidth: 18, textAlign: "center", fontWeight: 700 }}>{item.quantity}</span>
                        <button type="button" style={qtyButtonStyle} onClick={() => adjustQuantity(item.productId, 1)}>+</button>
                      </div>

                      <button type="button" style={removeButtonStyle} onClick={() => removeFromCart(item.productId)}>ဖယ်ထုတ်မည်</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: "1px solid #edf2f7", marginTop: 18, paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ color: "#475467" }}>စုစုပေါင်းကျသင့်ငွေ</span>
                <strong className="price-value">{money(totalAmount)}</strong>
              </div>

              <label style={labelStyle}>လက်ခံရရှိငွေ</label>
              <input
                type="number"
                min="0"
                className="price-input"
                value={cashReceived}
                onChange={(event) => setCashReceived(event.target.value)}
                placeholder="0"
                style={{ ...inputStyle, marginTop: 8 }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, marginBottom: 18 }}>
                <span style={{ color: "#475467" }}>ပြန်အမ်းငွေ</span>
                <strong className="price-value" style={{ color: changeAmount >= 0 ? "#667085" : "#b91c1c" }}>{money(Math.max(changeAmount, 0))}</strong>
              </div>

              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={!canCompleteSale}
                style={{
                  ...primaryButtonStyle,
                  opacity: canCompleteSale ? 1 : 0.5,
                  cursor: canCompleteSale ? "pointer" : "not-allowed",
                  width: "100%",
                  fontSize: 16,
                }}
              >
                အရောင်းအတည်ပြုမည်
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const panelStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e8edf5",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.02)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #dfe7f0",
  borderRadius: 10,
  padding: "11px 12px",
  background: "#fff",
  color: "#162033",
  outline: "none",
};

const productCardStyle: React.CSSProperties = {
  display: "block",
  textAlign: "left",
  background: "#fff",
  border: "1px solid #e8edf5",
  borderRadius: 14,
  padding: 14,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const stockBadgeStyle: React.CSSProperties = {
  background: "#edf4ff",
  color: "#0F766E",
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 11,
  fontWeight: 700,
};

const cartItemStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e8edf5",
  borderRadius: 12,
  padding: 12,
};

const qtyButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid #dfe7f0",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const removeButtonStyle: React.CSSProperties = {
  background: "#fff2f2",
  color: "#c2410c",
  border: "1px solid #ffd4d4",
  borderRadius: 8,
  padding: "7px 10px",
  cursor: "pointer",
  fontWeight: 600,
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#0F766E",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 18px",
  fontWeight: 800,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#475467",
  fontWeight: 700,
};

const noticeStyle: React.CSSProperties = {
  marginBottom: 14,
  padding: "10px 12px",
  border: "1px solid #c8f5d4",
  background: "#f1fff4",
  color: "#166534",
  borderRadius: 10,
};

const errorStyle: React.CSSProperties = {
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#9f1239",
  padding: "10px 12px",
  borderRadius: 10,
  marginBottom: 16,
};
