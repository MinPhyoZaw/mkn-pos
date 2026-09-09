'use client';

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import type { Category, Product, ProductFormData } from "@/types/electron";

const emptyForm: ProductFormData = {
  name: "",
  categoryId: null,
  costPrice: 0,
  sellingPrice: 0,
  stockQty: 0,
  lowStockLevel: 5,
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value) + " ကျပ်";

export default function Page() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStockStatus, setSelectedStockStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [defaultLowStockLevel, setDefaultLowStockLevel] = useState(5);

  const fetchProducts = async () => {
    const electronApi = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (!electronApi?.products?.getAll) {
      setProducts([]);
      return;
    }

    const rows = await electronApi.products.getAll();
    setProducts(rows);
  };

  const fetchCategories = async () => {
    const electronApi = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (!electronApi?.categories?.getAll) {
      setCategories([]);
      return;
    }

    const rows = await electronApi.categories.getAll();
    setCategories(rows);
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      const electronApi = typeof window !== "undefined" ? (window as any).electron : undefined;
      if (!electronApi) {
        setProducts([]);
        setCategories([]);
        return;
      }

      const [settings] = await Promise.all([electronApi.settings?.getAll?.(), fetchProducts(), fetchCategories()]);
      if (settings) setDefaultLowStockLevel(settings.defaultLowStockLevel);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch = !query || product.name.toLowerCase().includes(query);
      const matchesCategory = selectedCategory === "all" || String(product.categoryId) === selectedCategory;
      const status = product.stockQty <= 0 ? "out" : product.stockQty <= product.lowStockLevel ? "low" : "in";
      const matchesStockStatus = selectedStockStatus === "all" || status === selectedStockStatus;
      return matchesSearch && matchesCategory && matchesStockStatus;
    });
  }, [products, search, selectedCategory, selectedStockStatus]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ ...emptyForm, lowStockLevel: defaultLowStockLevel });
    setFormError("");
    setFormOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      categoryId: product.categoryId,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      stockQty: product.stockQty,
      lowStockLevel: product.lowStockLevel,
    });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setCategoryInput("");
  };

  const handleFieldChange = (field: keyof ProductFormData, value: string | number | null) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCreateCategory = async () => {
    const name = categoryInput.trim();
    if (!name) {
      setFormError("Category name is required.");
      return;
    }

    const electronApi = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (!electronApi?.categories?.create) {
      setFormError("Electron category API is unavailable.");
      return;
    }

    setCreatingCategory(true);
    try {
      const created = await electronApi.categories.create({ name });
      setCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, categoryId: created.id }));
      setCategoryInput("");
      setFormError("");
      setNotice(`Category "${created.name}" added.`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create category.");
    } finally {
      setCreatingCategory(false);
    }
  };

  const submitForm = async () => {
    const trimmedName = form.name.trim();

    if (!trimmedName) {
      setFormError("Product name is required.");
      return;
    }
    if (categories.length > 0 && (form.categoryId === null || form.categoryId === undefined)) {
      setFormError("Please select a category.");
      return;
    }
    if (form.costPrice < 0 || form.sellingPrice < 0 || form.stockQty < 0 || form.lowStockLevel < 0) {
      setFormError("Prices and quantities must not be negative.");
      return;
    }

    const payload: ProductFormData = {
      ...form,
      name: trimmedName,
      categoryId: form.categoryId === null || form.categoryId === undefined ? null : Number(form.categoryId),
      costPrice: Number(form.costPrice),
      sellingPrice: Number(form.sellingPrice),
      stockQty: Number(form.stockQty),
      lowStockLevel: Number(form.lowStockLevel),
    };

    const electronApi = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (!electronApi?.products) {
      setFormError("Electron product API is unavailable.");
      return;
    }

    setSaveLoading(true);
    try {
      if (editingId !== null) {
        await electronApi.products.update(editingId, payload);
      } else {
        await electronApi.products.create(payload);
      }

      await refreshData();
      closeForm();
      setNotice(editingId === null ? "Product created successfully." : "Product updated successfully.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save product.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (typeof window === "undefined") return;
    const confirmDelete = window.confirm("ယခုကုန်ပစ္စည်းကို ဖျက်ရန်သေချာပြီလား ?");
    if (!confirmDelete) return;

    const electronApi = (window as any).electron;
    if (!electronApi?.products?.delete) {
      window.alert("Electron product API is unavailable.");
      return;
    }

    try {
      await electronApi.products.delete(product.id);
      await refreshData();
      setNotice(`Product "${product.name}" deleted.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ဤကုန်ပစ္စည်းကို ယခင်အရောင်းမှတ်တမ်းများတွင် အသုံးပြုထားပြီးဖြစ်သောကြောင့် ဖျက်၍မရပါ။ မရောင်းတော့ပါက Inactive လုပ်ထားနိုင်ပါသည်။";
      window.alert(message);
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 1260, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>ကုန်ပစ္စည်းစာမျက်နှာ</h1>
            <p style={{ margin: "8px 0 0", color: "#667085" }}>သင့်ဆိုင်ရဲ့ကုန်ပစ္စည်းများကိုအလွယ်တကူစီမံခန့်ခွဲလိုက်ပါ</p>
          </div>
          <button onClick={openCreateModal} style={primaryButtonStyle}>ကုန်ပစ္စည်းအသစ်ထည့်မည်</button>
        </div>

        {notice ? (
          <div style={noticeStyle}>{notice}</div>
        ) : null}

        <div style={toolbarStyle}>
          <input
            type="text"
            placeholder="ကုန်ပစ္စည်းရှာမည်..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={inputStyle}
          />

          <select style={inputStyle} value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
          <select style={inputStyle} value={selectedStockStatus} onChange={(event) => setSelectedStockStatus(event.target.value)}>
            <option value="all">လက်ကျန်အခြေနေ: All</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>

        <div style={tableCardStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475467" }}>
                <th style={thStyle}>ကုန်ပစ္စည်းအမည်</th>
                <th style={thStyle}>အမျိုးအစား</th>
                <th style={thStyle}>၀ယ်ဈေး</th>
                <th style={thStyle}>ရောင်းဈေး</th>
                <th style={thStyle}>လက်ကျန်</th>
                <th style={thStyle}>အခြေနေ</th>
                <th style={thStyle}>လုပ်ဆောင်ချက်</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "#667085" }}>
                    ကုန်ပစ္စည်းရှာမတွေ့ပါ (မရှိသေးပါ)
                  </td>
                </tr>
              ) : null}

              {filteredProducts.map((product) => {
                const status = product.stockQty <= 0 ? "Out of Stock" : product.stockQty <= product.lowStockLevel ? "Low Stock" : "In Stock";

                return (
                  <tr key={product.id} className="product-row">
                    <td className="product-name-cell" style={tdStyle}><strong>{product.name}</strong></td>
                    <td style={tdStyle}><span className="product-category-badge">{product.category?.name ?? "Uncategorized"}</span></td>
                    <td style={tdStyle}>{money(product.costPrice)}</td>
                    <td style={tdStyle}>{money(product.sellingPrice)}</td>
                    <td style={tdStyle}>{product.stockQty}</td>
                    <td style={tdStyle}>
                      <span className={`product-status-badge ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="product-action-edit" style={rowEditButtonStyle} onClick={() => openEditModal(product)}>Edit</button>
                        <button className="product-action-delete" style={rowDeleteButtonStyle} onClick={() => handleDelete(product)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {formOpen ? (
          <div style={modalBackdropStyle} onClick={closeForm}>
            <div
              style={modalStyle}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h2 style={{ margin: 0, fontSize: 24 }}>{editingId === null ? "Add Product" : "Edit Product"}</h2>
                <button onClick={closeForm} style={closeButtonStyle}>×</button>
              </div>

              {formError ? <div style={errorStyle}>{formError}</div> : null}

              <div style={fieldGridStyle}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>ကုန်ပစ္စည်းအမည်</label>
                  <input
                    autoFocus={editingId === null}
                    value={form.name}
                    onChange={(event) => handleFieldChange("name", event.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>အမျိုးအစား</label>
                  <select
                    value={form.categoryId ?? ""}
                    onChange={(event) => handleFieldChange("categoryId", event.target.value === "" ? null : Number(event.target.value))}
                    style={inputStyle}
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>၀ယ်ဈေး</label>
                  <input
                    type="number"
                    min="0"
                    className="price-input"
                    value={form.costPrice}
                    onChange={(event) => handleFieldChange("costPrice", Number(event.target.value))}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>ရောင်းဈေး</label>
                  <input
                    type="number"
                    min="0"
                    className="price-input"
                    value={form.sellingPrice}
                    onChange={(event) => handleFieldChange("sellingPrice", Number(event.target.value))}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>လက်ကျန်အရေအတွက်</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stockQty}
                    onChange={(event) => handleFieldChange("stockQty", Number(event.target.value))}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>လက်ကျန်သတိပေးရန် အရေအတွက်</label>
                  <input
                    type="number"
                    min="0"
                    value={form.lowStockLevel}
                    onChange={(event) => handleFieldChange("lowStockLevel", Number(event.target.value))}
                    style={inputStyle}
                  />
                </div>
              </div>

              {categories.length === 0 ? (
                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <input
                    placeholder="New category name"
                    value={categoryInput}
                    onChange={(event) => setCategoryInput(event.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button style={secondaryButtonStyle} onClick={handleCreateCategory} disabled={creatingCategory}>
                    {creatingCategory ? "Saving..." : "Add Category"}
                  </button>
                </div>
              ) : null}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                <button style={secondaryButtonStyle} onClick={closeForm}>Cancel</button>
                <button style={primaryButtonStyle} onClick={submitForm} disabled={saveLoading}>
                  {saveLoading ? "Saving..." : editingId === null ? "Create Product" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 20,
  alignItems: "center",
};

const tableCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "16px 14px",
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle: React.CSSProperties = {
  padding: "16px 14px",
  color: "#64748b",
  fontSize: 14,
  verticalAlign: "middle",
  borderBottom: "1px solid #eef2f7",
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

const primaryButtonStyle: React.CSSProperties = {
  background: "#1769e0",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "10px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#f3f6fb",
  color: "#1f2937",
  border: "1px solid #dfe7f0",
  borderRadius: 10,
  padding: "10px 16px",
  fontWeight: 600,
  cursor: "pointer",
};

const editButtonStyle: React.CSSProperties = {
  background: "#edf4ff",
  color: "#1769e0",
  border: "1px solid #dfe8ff",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
  fontWeight: 600,
};

const deleteButtonStyle: React.CSSProperties = {
  background: "#fff2f2",
  color: "#c2410c",
  border: "1px solid #ffd4d4",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
  fontWeight: 600,
};

const rowEditButtonStyle: React.CSSProperties = {
  ...editButtonStyle,
  background: "transparent",
  color: "#2563eb",
  border: "none",
  padding: "6px 4px",
};

const rowDeleteButtonStyle: React.CSSProperties = {
  ...deleteButtonStyle,
  background: "transparent",
  color: "#b91c1c",
  border: "none",
  padding: "6px 4px",
};

const noticeStyle: React.CSSProperties = {
  marginBottom: 14,
  padding: "10px 12px",
  border: "1px solid #c8f5d4",
  background: "#f1fff4",
  color: "#166534",
  borderRadius: 10,
};

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 30,
};

const modalStyle: React.CSSProperties = {
  background: "#fff",
  width: "min(760px, 92vw)",
  borderRadius: 18,
  padding: 22,
  border: "1px solid #e8edf5",
  boxShadow: "0 18px 50px rgba(15, 23, 42, 0.16)",
};

const fieldGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#475467",
  fontWeight: 700,
};

const closeButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#f3f6fb",
  borderRadius: 8,
  width: 32,
  height: 32,
  cursor: "pointer",
  fontSize: 22,
  lineHeight: 1,
  color: "#475467",
};

const inStockBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#ecfdf5",
  color: "#047857",
  fontSize: 12,
  fontWeight: 700,
};

const lowStockBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#fff7ed",
  color: "#b45309",
  fontSize: 12,
  fontWeight: 700,
};

const errorStyle: React.CSSProperties = {
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#9f1239",
  padding: "10px 12px",
  borderRadius: 10,
  marginBottom: 16,
};

