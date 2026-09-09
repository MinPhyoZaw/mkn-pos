"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import type { SaleHistoryRow, SaleSource, SaleStatus } from "@/types/electron";
import "./sales-history.css";

type DateRange = "TODAY" | "LAST_7_DAYS" | "THIS_MONTH" | "ALL_TIME";
const money = (value: number) => `${new Intl.NumberFormat("en-US").format(value)} ကျပ်`;
const getElectronApi = () => (typeof window !== "undefined" ? window.electron : undefined);

function dateBounds(range: DateRange) {
	if (range === "ALL_TIME") return {};
	const now = new Date();
	const start = new Date(now); start.setHours(0, 0, 0, 0);
	if (range === "LAST_7_DAYS") start.setDate(start.getDate() - 6);
	if (range === "THIS_MONTH") start.setDate(1);
	const end = new Date(now); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 1);
	return { from: start.toISOString(), to: end.toISOString() };
}

function formatDate(value: string, withTime = false) {
	return new Date(value).toLocaleString("en-US", withTime ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", year: "numeric" });
}

export default function SalesHistoryPage() {
	const [sales, setSales] = useState<SaleHistoryRow[]>([]);
	const [search, setSearch] = useState("");
	const [dateRange, setDateRange] = useState<DateRange>("ALL_TIME");
	const [source, setSource] = useState<"ALL" | SaleSource>("ALL");
	const [status, setStatus] = useState<"ALL" | SaleStatus>("ALL");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [selectedSale, setSelectedSale] = useState<SaleHistoryRow | null>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	const load = async () => {
		setError("");
		try {
			const api = getElectronApi();
			if (!api?.salesHistory?.getAll) throw new Error("Sales History API is unavailable. Please restart the POS application.");
			setSales(await api.salesHistory.getAll());
		} catch (err) { setError(err instanceof Error ? err.message : "Unable to load sales history."); }
	};
	useEffect(() => { load(); }, []);

	const filteredSales = useMemo(() => {
		const query = search.trim().replace(/^#/, "").toLowerCase();
		const bounds = dateBounds(dateRange);
		const from = bounds.from ? new Date(bounds.from).getTime() : -Infinity;
		const to = bounds.to ? new Date(bounds.to).getTime() : Infinity;
		return sales.filter((sale) => (!query || String(sale.id).includes(query)) && (source === "ALL" || sale.source === source) && (status === "ALL" || sale.status === status) && new Date(sale.createdAt).getTime() >= from && new Date(sale.createdAt).getTime() < to);
	}, [sales, search, dateRange, source, status]);

	const pageCount = Math.max(1, Math.ceil(filteredSales.length / pageSize));
	const visibleSales = filteredSales.slice((page - 1) * pageSize, page * pageSize);
	useEffect(() => { setPage(1); }, [search, dateRange, source, status, pageSize]);

	const completed = sales.filter((sale) => sale.status === "COMPLETED");
	const today = new Date(); today.setHours(0, 0, 0, 0);
	const month = new Date(today.getFullYear(), today.getMonth(), 1);
	const todaySales = completed.filter((sale) => new Date(sale.createdAt) >= today).reduce((sum, sale) => sum + sale.totalAmount, 0);
	const monthSales = completed.filter((sale) => new Date(sale.createdAt) >= month).reduce((sum, sale) => sum + sale.totalAmount, 0);
	const monthProfit = completed.filter((sale) => new Date(sale.createdAt) >= month).reduce((sum, sale) => sum + sale.grossProfit, 0);

	const voidSale = async (sale: SaleHistoryRow) => {
		if (sale.status !== "COMPLETED" || !window.confirm(`Void Sale #${sale.id}?\n\nThis will mark the sale as cancelled, return sold quantities to stock, and create reversal movements.\n\nThis action cannot be silently undone.`)) return;
		try {
			const api = getElectronApi();
			if (!api?.salesHistory?.voidSale) throw new Error("Sales History API is unavailable. Please restart the POS application.");
			const updated = await api.salesHistory.voidSale(sale.id);
			setSales((rows) => rows.map((row) => row.id === updated.id ? updated : row));
			setSelectedSale(updated); setNotice(`Sale #${sale.id} voided successfully.`);
		} catch (err) { setError(err instanceof Error ? err.message : "Unable to void sale."); }
	};

	return <AppShell><div className="sales-history-page">
		<header className="sales-history-header"><div><h1>အရောင်းမှတ်တမ်း</h1><p>Review completed and cancelled transactions.</p></div></header>
		{notice && <div className="history-notice">{notice}</div>}{error && <div className="history-error">{error}</div>}
		<section className="history-summary"><Summary label="ယနေ့ရောင်းရငွေ" value={money(todaySales)} tone="blue" /><Summary label="ယခုလ ရောင်းရငွေ" value={money(monthSales)} tone="green" /><Summary label="ယခုလ အသားတင်အမြတ်" value={money(monthProfit)} tone="violet" /><Summary label="စုစုပေါင်းအရောင်းအကြိမ်ရေ" value={String(sales.length)} tone="orange" /></section>
		<section className="history-panel"><div className="history-filters"><input placeholder="Search Sale #..." value={search} onChange={(event) => setSearch(event.target.value)} /><select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)}><option value="ALL_TIME">All Time</option><option value="TODAY">Today</option><option value="LAST_7_DAYS">Last 7 Days</option><option value="THIS_MONTH">This Month</option></select><select value={source} onChange={(event) => setSource(event.target.value as "ALL" | SaleSource)}><option value="ALL">Source: All</option><option value="POS">POS</option><option value="ORDER">Order</option></select><select value={status} onChange={(event) => setStatus(event.target.value as "ALL" | SaleStatus)}><option value="ALL">Status: All</option><option value="COMPLETED">အောင်မြင်</option><option value="CANCELLED">မအောင်မြင်</option></select></div>
			<div className="history-table-wrap"><table className="history-table"><thead><tr><th>Sale ID</th><th>Date &amp; Time</th><th>ကုန်ပစ္စည်းပေါင်း</th><th>အရေအတွက်</th><th>စုစုပေါင်းတန်ဖိုး</th><th>အမြတ်</th><th>Source</th><th>အခြေ‌အနေ</th><th>လုပ်ဆောင်ချက်</th></tr></thead><tbody>
				{!visibleSales.length && <tr><td colSpan={9} className="history-empty"><strong>No sales history yet.</strong><span>Completed transactions will appear here.</span></td></tr>}
				{visibleSales.map((sale) => <tr key={sale.id}><td><strong>#{sale.id}</strong></td><td>{formatDate(sale.createdAt, true)}</td><td>{sale.itemCount}</td><td>{sale.totalQuantity}</td><td className="history-price">{money(sale.totalAmount)}</td><td className="history-price">{money(sale.grossProfit)}</td><td><span className={`source-badge ${sale.source.toLowerCase()}`}>{sale.source}</span></td><td><span className={`status-badge ${sale.status.toLowerCase()}`}>{sale.status === "COMPLETED" ? "Completed" : "Cancelled"}</span></td><td><button className="view-button" onClick={() => setSelectedSale(sale)}>View</button></td></tr>)}
			</tbody></table></div><div className="history-pagination"><label>Rows <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label><span>{filteredSales.length ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filteredSales.length)} of ${filteredSales.length}` : "0 sales"}</span><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></section>
	</div>
	{selectedSale && <div className="history-modal-backdrop" onMouseDown={() => setSelectedSale(null)}><div className="history-modal" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><div className="history-modal-heading"><div><h2>Sale #{selectedSale.id}</h2><p>{formatDate(selectedSale.createdAt, true)}</p></div><button className="history-close" onClick={() => setSelectedSale(null)}>×</button></div><div className="sale-meta"><span>Source <strong>{selectedSale.source}</strong></span><span>Status <strong>{selectedSale.status === "COMPLETED" ? "Completed" : "Cancelled"}</strong></span></div><table className="detail-sale-table"><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th></tr></thead><tbody>{selectedSale.items.map((item) => <tr key={item.id}><td><strong>{item.productName}</strong><small>Cost {money(item.costPrice)} / Profit {money(item.profit)}</small></td><td>{money(item.unitPrice)}</td><td>{item.quantity}</td><td>{money(item.subtotal)}</td></tr>)}</tbody></table><div className="sale-totals"><span>Total <strong>{money(selectedSale.totalAmount)}</strong></span><span>Cash Received <strong>{money(selectedSale.cashReceived)}</strong></span><span>Change <strong>{money(selectedSale.changeAmount)}</strong></span><span>Gross Profit <strong>{money(selectedSale.grossProfit)}</strong></span></div><div className="history-modal-actions">{selectedSale.status === "COMPLETED" && <button className="void-button" onClick={() => voidSale(selectedSale)}>Void Sale</button>}<button className="history-primary" onClick={() => setSelectedSale(null)}>Close</button></div></div></div>}
	</AppShell>;
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className={`history-summary-card ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
