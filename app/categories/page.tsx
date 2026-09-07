'use client';

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import type { Category } from "@/types/electron";

const defaultCategories = [
  "Toys",
  "Stationery",
  "Notebooks & Paper",
  "School Supplies",
  "Art & Craft",
  "Office Supplies",
  "Bags & Accessories",
  "Gifts",
  "Other",
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCategories = async () => {
    const electronApi = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (!electronApi?.categories?.getAll) {
      setCategories([]);
      return;
    }

    const rows = await electronApi.categories.getAll();
    setCategories(rows);
  };

  const ensureDefaultCategories = async () => {
    const electronApi = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (!electronApi?.categories?.getAll || !electronApi?.categories?.create) return;

    const existing = await electronApi.categories.getAll();
    const existingNames = new Set(existing.map((category: Category) => category.name.trim().toLowerCase()));
    const missing = defaultCategories.filter((item) => !existingNames.has(item.trim().toLowerCase()));

    for (const item of missing) {
      try {
        await electronApi.categories.create({ name: item });
      } catch {
        // Ignore duplicate/seed races and continue.
      }
    }
  };

  const refreshCategories = async () => {
    setLoading(true);
    try {
      await ensureDefaultCategories();
      await loadCategories();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCategories();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setName("");
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setName("");
    setError("");
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Category name is required.");
      return;
    }

    const electronApi = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (!electronApi?.categories) {
      setError("Category API is unavailable.");
      return;
    }

    setSaving(true);
    try {
      if (editingId !== null) {
        await electronApi.categories.update(editingId, { name: trimmedName });
        setNotice("Category updated successfully.");
      } else {
        await electronApi.categories.create({ name: trimmedName });
        setNotice("Category created successfully.");
      }

      await refreshCategories();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save category.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    const confirmed = window.confirm("Are you sure you want to delete this category?");
    if (!confirmed) return;

    const electronApi = typeof window !== "undefined" ? (window as any).electron : undefined;
    if (!electronApi?.categories?.delete) {
      window.alert("Category API is unavailable.");
      return;
    }

    try {
      await electronApi.categories.delete(category.id);
      await refreshCategories();
      setNotice(`Category "${category.name}" deleted.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete category.";
      window.alert(message);
    }
  };

  const formatDate = (value: string | Date | undefined) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Categories</h1>
            <p style={{ margin: "8px 0 0", color: "#667085" }}>Manage product categories</p>
          </div>
          <button onClick={openCreateModal} style={primaryButtonStyle}>+ Add Category</button>
        </div>

        {notice ? <div style={noticeStyle}>{notice}</div> : null}

        <div style={tableCardStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475467" }}>
                <th style={thStyle}>Category Name</th>
                <th style={thStyle}>Products</th>
                <th style={thStyle}>Created Date</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#667085" }}>
                    Loading categories...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#667085" }}>
                    No categories found.
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id} style={{ borderTop: "1px solid #edf2f7" }}>
                    <td style={tdStyle}>{category.name}</td>
                    <td style={tdStyle}>{category._count?.products ?? 0}</td>
                    <td style={tdStyle}>{formatDate(category.createdAt)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={editButtonStyle} onClick={() => openEditModal(category)}>Edit</button>
                        <button style={deleteButtonStyle} onClick={() => handleDelete(category)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {modalOpen ? (
          <div style={modalBackdropStyle} onClick={closeModal}>
            <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 24 }}>{editingId === null ? "Add Category" : "Edit Category"}</h2>
                <button onClick={closeModal} style={closeButtonStyle}>×</button>
              </div>

              {error ? <div style={errorStyle}>{error}</div> : null}

              <label style={labelStyle}>Category Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter category name"
                style={{ ...inputStyle, marginTop: 8 }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                <button style={secondaryButtonStyle} onClick={closeModal}>Cancel</button>
                <button style={primaryButtonStyle} onClick={handleSubmit} disabled={saving}>
                  {saving ? "Saving..." : editingId === null ? "Create Category" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

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
  width: "min(520px, 90vw)",
  borderRadius: 18,
  padding: 22,
  border: "1px solid #e8edf5",
  boxShadow: "0 18px 50px rgba(15, 23, 42, 0.16)",
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

const labelStyle: React.CSSProperties = {
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
