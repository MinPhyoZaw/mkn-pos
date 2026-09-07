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
  }).format(value) + " MMK";

export default function Page() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

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

      await Promise.all([fetchProducts(), fetchCategories()]);
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
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
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
    const confirmDelete = window.confirm("Are you sure you want to delete this product?");
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
      const message = error instanceof Error ? error.message : "This product cannot be deleted because it is referenced by sales records.";
      window.alert(message);
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 1260, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Products</h1>
            <p style={{ margin: "8px 0 0", color: "#667085" }}>Manage your shop products</p>
          </div>
          <button onClick={openCreateModal} style={primaryButtonStyle}>+ Add Product</button>
        </div>

        {notice ? (
          <div style={noticeStyle}>{notice}</div>
        ) : null}

        <div style={toolbarStyle}>
          <input
            type="text"
            placeholder="Search products..."
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
        </div>

        <div style={tableCardStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475467" }}>
                <th style={thStyle}>Product Name</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Cost Price</th>
                <th style={thStyle}>Selling Price</th>
                <th style={thStyle}>Stock</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "#667085" }}>
                    No products found.
                  </td>
                </tr>
              ) : null}

              {filteredProducts.map((product) => {
                const isLowStock = product.stockQty <= product.lowStockLevel;

                return (
                  <tr key={product.id} style={{ borderTop: "1px solid #edf2f7" }}>
                    <td style={tdStyle}>{product.name}</td>
                    <td style={tdStyle}>{product.category?.name ?? "Uncategorized"}</td>
                    <td style={tdStyle}>{money(product.costPrice)}</td>
                    <td style={tdStyle}>{money(product.sellingPrice)}</td>
                    <td style={tdStyle}>{product.stockQty}</td>
                    <td style={tdStyle}>
                      <span style={isLowStock ? lowStockBadgeStyle : inStockBadgeStyle}>{isLowStock ? "Low Stock" : "In Stock"}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={editButtonStyle} onClick={() => openEditModal(product)}>Edit</button>
                        <button style={deleteButtonStyle} onClick={() => handleDelete(product)}>Delete</button>
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
            <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h2 style={{ margin: 0, fontSize: 24 }}>{editingId === null ? "Add Product" : "Edit Product"}</h2>
                <button onClick={closeForm} style={closeButtonStyle}>×</button>
              </div>

              {formError ? <div style={errorStyle}>{formError}</div> : null}

              <div style={fieldGridStyle}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Product Name</label>
                  <input
                    value={form.name}
                    onChange={(event) => handleFieldChange("name", event.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Category</label>
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
                  <label style={labelStyle}>Cost Price</label>
                  <input
                    type="number"
                    min="0"
                    value={form.costPrice}
                    onChange={(event) => handleFieldChange("costPrice", Number(event.target.value))}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Selling Price</label>
                  <input
                    type="number"
                    min="0"
                    value={form.sellingPrice}
                    onChange={(event) => handleFieldChange("sellingPrice", Number(event.target.value))}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Initial Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stockQty}
                    onChange={(event) => handleFieldChange("stockQty", Number(event.target.value))}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Low Stock Alert Level</label>
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
  border: "1px solid #e8edf5",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.02)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "16px 14px",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle: React.CSSProperties = {
  padding: "16px 14px",
  color: "#1f2937",
  fontSize: 14,
  verticalAlign: "middle",
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

