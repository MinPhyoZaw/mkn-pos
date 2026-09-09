"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import type { Product, StockMovement } from "@/types/electron";
import "./stock.css";

type StockFilter = "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
type ModalMode = "ADD" | "ADJUST";

const reasons = ["Damaged", "Lost", "Correction", "Other"];
const getElectronApi = () => (typeof window !== "undefined" ? window.electron : undefined);

function stockStatus(product: Product) {
	if (product.stockQty <= 0) return "OUT_OF_STOCK";
	if (product.stockQty <= product.lowStockLevel) return "LOW_STOCK";
	return "IN_STOCK";
}

function statusLabel(status: string) {
	return status === "IN_STOCK" ? "In Stock" : status === "LOW_STOCK" ? "Low Stock" : "Out of Stock";
}

function formatDate(value: string | Date) {
	return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function StockPage() {
	const [products, setProducts] = useState<Product[]>([]);
	const [movements, setMovements] = useState<StockMovement[]>([]);
	const [categories, setCategories] = useState<string[]>([]);
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("ALL");
	const [stockFilter, setStockFilter] = useState<StockFilter>("ALL");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [modalMode, setModalMode] = useState<ModalMode | null>(null);
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [quantity, setQuantity] = useState("");
	const [reason, setReason] = useState(reasons[0]);
	const [note, setNote] = useState("");
	const [saving, setSaving] = useState(false);

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			const api = getElectronApi();
			if (!api?.stock?.getProducts || !api.stock.getMovements || !api.categories?.getAll) throw new Error("Stock API is unavailable. Please restart the POS application.");
			const [productRows, movementRows, categoryRows] = await Promise.all([api.stock.getProducts(), api.stock.getMovements(), api.categories.getAll()]);
			setProducts(productRows);
			setMovements(movementRows);
			setCategories(categoryRows.map((category) => category.name).sort());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unable to load stock.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); }, []);

	const filteredProducts = useMemo(() => {
		const query = search.trim().toLowerCase();
		return products.filter((product) => (!query || product.name.toLowerCase().includes(query)) && (category === "ALL" || product.category?.name === category) && (stockFilter === "ALL" || stockStatus(product) === stockFilter));
	}, [products, search, category, stockFilter]);

	const summary = useMemo(() => ({
		total: products.length,
		inStock: products.filter((product) => stockStatus(product) === "IN_STOCK").length,
		lowStock: products.filter((product) => stockStatus(product) === "LOW_STOCK").length,
		outOfStock: products.filter((product) => stockStatus(product) === "OUT_OF_STOCK").length,
	}), [products]);

	const openModal = (product: Product, mode: ModalMode) => {
		setSelectedProduct(product); setModalMode(mode); setQuantity(""); setReason(reasons[0]); setNote(""); setError("");
	};
	const closeModal = () => { if (!saving) { setModalMode(null); setSelectedProduct(null); } };

	const submitStockChange = async () => {
		const amount = Number(quantity);
		if (!Number.isInteger(amount) || (modalMode === "ADD" ? amount <= 0 : amount === 0)) {
			setError(modalMode === "ADD" ? "Quantity to add must be greater than zero." : "Adjustment cannot be zero.");
			return;
		}
		if (!selectedProduct) return;
		setSaving(true); setError("");
		try {
			const api = getElectronApi();
			if (!api?.stock) throw new Error("Stock API is unavailable. Please restart the POS application.");
			if (modalMode === "ADD") { await api.stock.add(selectedProduct.id, amount, note); setNotice("Stock added successfully."); }
			else { await api.stock.adjust(selectedProduct.id, amount, reason, note); setNotice("Stock adjusted successfully."); }
			setModalMode(null); setSelectedProduct(null); await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unable to update stock.");
		} finally { setSaving(false); }
	};

	return <AppShell><div className="stock-page">
		<header className="stock-header"><div><h1>Stock Management</h1><p>Track inventory levels and stock movements.</p></div></header>
		{notice && <div className="stock-notice">{notice}</div>}{error && !modalMode && <div className="stock-error">{error}</div>}
		<section className="stock-summary-grid"><SummaryCard label="Total Products" value={summary.total} className="total" /><SummaryCard label="In Stock" value={summary.inStock} className="in-stock" /><SummaryCard label="Low Stock" value={summary.lowStock} className="low-stock" /><SummaryCard label="Out of Stock" value={summary.outOfStock} className="out-stock" /></section>
		<section className="stock-panel"><div className="stock-filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." /><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">Category: All</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}</select><select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as StockFilter)}><option value="ALL">All Stock</option><option value="IN_STOCK">In Stock</option><option value="LOW_STOCK">Low Stock</option><option value="OUT_OF_STOCK">Out of Stock</option></select></div>
			<div className="stock-table-wrap"><table className="stock-table"><thead><tr><th>Product</th><th>Category</th><th>Current Stock</th><th>Low Stock Alert</th><th>Status</th><th>Actions</th></tr></thead><tbody>
				{loading && <tr><td colSpan={6} className="stock-empty">Loading products...</td></tr>}
				{!loading && !filteredProducts.length && <tr><td colSpan={6} className="stock-empty"><strong>No products found.</strong><span>Add products first to manage stock.</span></td></tr>}
				{filteredProducts.map((product) => { const status = stockStatus(product); return <tr key={product.id}><td><strong>{product.name}</strong></td><td>{product.category?.name ?? "Uncategorized"}</td><td className="stock-number">{product.stockQty}</td><td>{product.lowStockLevel}</td><td><span className={`stock-badge ${status.toLowerCase()}`}>{statusLabel(status)}</span></td><td><div className="stock-actions"><button onClick={() => openModal(product, "ADD")}>+ Add Stock</button><button onClick={() => openModal(product, "ADJUST")}>Adjust</button></div></td></tr>; })}
			</tbody></table></div>
		</section>
		<section className="stock-panel movement-panel"><div className="movement-heading"><div><h2>Recent Stock Movements</h2><p>Latest changes to your inventory.</p></div></div><div className="stock-table-wrap"><table className="stock-table movement-table"><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Note</th></tr></thead><tbody>
			{!movements.length && <tr><td colSpan={5} className="stock-empty"><strong>No stock movements yet.</strong><span>Stock changes will appear here.</span></td></tr>}
			{movements.map((movement) => <tr key={movement.id}><td>{formatDate(movement.createdAt)}</td><td><strong>{movement.product.name}</strong></td><td><span className="movement-type">{movement.type}</span></td><td className={movement.quantity >= 0 ? "movement-positive" : "movement-negative"}>{movement.quantity > 0 ? "+" : ""}{movement.quantity}</td><td>{movement.note || "-"}</td></tr>)}
		</tbody></table></div></section>
	</div>
	{modalMode && selectedProduct && <div className="stock-modal-backdrop" onMouseDown={closeModal}><div className="stock-modal" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><div className="stock-modal-heading"><div><h2>{modalMode === "ADD" ? "Add Stock" : "Adjust Stock"}</h2><p>{selectedProduct.name}</p></div><button className="stock-close" onClick={closeModal}>×</button></div>{error && <div className="stock-error">{error}</div>}<div className="stock-current"><span>Current Stock</span><strong>{selectedProduct.stockQty}</strong></div><label>{modalMode === "ADD" ? "Quantity to Add *" : "Adjustment *"}<input autoFocus type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={modalMode === "ADD" ? "20" : "-2"} /></label>{modalMode === "ADJUST" && <label>Reason<select value={reason} onChange={(event) => setReason(event.target.value)}>{reasons.map((item) => <option key={item}>{item}</option>)}</select></label>}<label>Note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={modalMode === "ADD" ? "New shipment" : "Packaging damaged"} /></label><div className="stock-modal-actions"><button onClick={closeModal}>Cancel</button><button className="stock-primary" disabled={saving} onClick={submitStockChange}>{saving ? "Saving..." : modalMode === "ADD" ? "Add Stock" : "Save Adjustment"}</button></div></div></div>}
	</AppShell>;
}

function SummaryCard({ label, value, className }: { label: string; value: number; className: string }) { return <div className={`stock-summary-card ${className}`}><span>{label}</span><strong>{value}</strong></div>; }
