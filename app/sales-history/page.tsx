"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import type { SaleHistoryRow, SaleSource, SaleStatus } from "@/types/electron";
import "./sales-history.css";

type DateRange = "TODAY" | "LAST_7_DAYS" | "THIS_MONTH" | "MONTH" | "CUSTOM";
const money = (value: number) => `${new Intl.NumberFormat("en-US").format(value)} ကျပ်`;
const getElectronApi = () => (typeof window !== "undefined" ? window.electron : undefined);

function localDateInput(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function localMonthInput(date = new Date()) { return localDateInput(date).slice(0, 7); }
function monthLabel(value: string) { return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }); }

function formatDate(value: string, withTime = false) {
	return new Date(value).toLocaleString("en-US", withTime ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", year: "numeric" });
}

export default function SalesHistoryPage() {
	const [sales, setSales] = useState<SaleHistoryRow[]>([]);
	const [search, setSearch] = useState("");
	const [dateRange, setDateRange] = useState<DateRange>("THIS_MONTH");
	const [month, setMonth] = useState(localMonthInput());
	const [fromDate, setFromDate] = useState(localDateInput(new Date(Date.now() - 6 * 86400000)));
	const [toDate, setToDate] = useState(localDateInput());
	const [source, setSource] = useState<"ALL" | SaleSource>("ALL");
	const [status, setStatus] = useState<"ALL" | SaleStatus>("ALL");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [selectedSale, setSelectedSale] = useState<SaleHistoryRow | null>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [summary, setSummary] = useState({ totalSales: 0, grossProfit: 0, transactions: 0, itemsSold: 0 });
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setError(""); setLoading(true);
		try {
			const api = getElectronApi();
			if (!api?.salesHistory?.getAll) throw new Error("Sales History API is unavailable. Please restart the POS application.");
			const result = await api.salesHistory.getAll({ filterType: dateRange.toLowerCase(), month, fromDate, toDate, search, source, status });
			setSales(result.sales); setSummary(result.summary);
		} catch (err) { setError(err instanceof Error ? err.message : "Unable to load sales history."); }
		finally { setLoading(false); }
	};
	useEffect(() => { setPage(1); load(); }, [dateRange, month, fromDate, toDate, search, source, status]);
	const pageCount = Math.max(1, Math.ceil(sales.length / pageSize));
	const visibleSales = sales.slice((page - 1) * pageSize, page * pageSize);
	const rangeLabel = dateRange === "TODAY" ? "Today" : dateRange === "THIS_MONTH" ? "This Month" : dateRange === "MONTH" ? monthLabel(month) : dateRange === "LAST_7_DAYS" ? "Last 7 Days" : "Selected Range";
	const salesLabel = dateRange === "TODAY" ? "Today's Sales" : dateRange === "THIS_MONTH" ? "This Month Sales" : dateRange === "MONTH" ? `${monthLabel(month)} Sales` : "Total Sales";
	const profitLabel = dateRange === "TODAY" ? "Today's Gross Profit" : dateRange === "THIS_MONTH" ? "This Month Gross Profit" : dateRange === "MONTH" ? `${monthLabel(month)} Gross Profit` : "Gross Profit";
	const transactionLabel = dateRange === "TODAY" ? "Today's Transactions" : "Transactions";
	const itemsLabel = dateRange === "TODAY" ? "Items Sold Today" : "Items Sold";

	const voidSale = async (sale: SaleHistoryRow) => {
		if (sale.status !== "COMPLETED" || !window.confirm(`Void Sale #${sale.id}?\n\nThis will mark the sale as cancelled, return sold quantities to stock, and create reversal movements.\n\nThis action cannot be silently undone.`)) return;
		try {
			const api = getElectronApi();
			if (!api?.salesHistory?.voidSale) throw new Error("Sales History API is unavailable. Please restart the POS application.");
			const updated = await api.salesHistory.voidSale(sale.id);
			setSelectedSale(updated); setNotice(`Sale #${sale.id} voided successfully.`); await load();
		} catch (err) { setError(err instanceof Error ? err.message : "Unable to void sale."); }
	};

	return <AppShell><div className="sales-history-page">
		<header className="sales-history-header"><div><h1>အရောင်းမှတ်တမ်း</h1><p>Review completed and cancelled transactions.</p></div></header>
		{notice && <div className="history-notice">{notice}</div>}{error && <div className="history-error">{error}</div>}
		<section className="history-summary"><Summary label={salesLabel} value={money(summary.totalSales)} tone="blue" /><Summary label={profitLabel} value={money(summary.grossProfit)} tone="green" /><Summary label={transactionLabel} value={String(summary.transactions)} tone="violet" /><Summary label={itemsLabel} value={String(summary.itemsSold)} tone="orange" /></section>
		<section className="history-panel"><div className="history-filters" style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}><input placeholder="Search Sale #..." value={search} onChange={(event) => setSearch(event.target.value)} /><div className="history-date-segments" style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4, background: "#ECFDF5", border: "1px solid #D9EEEA", borderRadius: 10 }}>{([["TODAY", "Today"], ["LAST_7_DAYS", "Last 7 Days"], ["THIS_MONTH", "This Month"], ["MONTH", "By Month"], ["CUSTOM", "Custom Range"]] as const).map(([value, label]) => <button key={value} style={{ border: 0, background: dateRange === value ? "#0F766E" : "transparent", color: dateRange === value ? "#fff" : "#0F766E", borderRadius: 7, padding: "7px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }} onClick={() => setDateRange(value)}>{label}</button>)}</div>{dateRange === "MONTH" && <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />}{dateRange === "CUSTOM" && <><label className="history-date-field">From Date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label className="history-date-field">To Date<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></>}<select value={source} onChange={(event) => setSource(event.target.value as "ALL" | SaleSource)}><option value="ALL">Source: All</option><option value="POS">POS</option><option value="ORDER">Order</option></select><select value={status} onChange={(event) => setStatus(event.target.value as "ALL" | SaleStatus)}><option value="ALL">Status: All</option><option value="COMPLETED">အောင်မြင်</option><option value="CANCELLED">မအောင်မြင်</option></select></div>
			<div className="history-table-wrap"><table className="history-table"><thead><tr><th>Sale ID</th><th>Date &amp; Time</th><th>ကုန်ပစ္စည်းပေါင်း</th><th>အရေအတွက်</th><th>စုစုပေါင်းတန်ဖိုး</th><th>အမြတ်</th><th>Source</th><th>အခြေ‌အနေ</th><th>လုပ်ဆောင်ချက်</th></tr></thead><tbody>
				{loading && <tr><td colSpan={9} className="history-empty">Loading sales history...</td></tr>}
				{!loading && !visibleSales.length && <tr><td colSpan={9} className="history-empty"><strong>No sales found for {rangeLabel}.</strong><span>Try selecting another date range.</span></td></tr>}
				{visibleSales.map((sale) => <tr key={sale.id}><td><strong>#{sale.id}</strong></td><td>{formatDate(sale.createdAt, true)}</td><td>{sale.itemCount}</td><td>{sale.totalQuantity}</td><td className="history-price">{money(sale.totalAmount)}</td><td className="history-price">{money(sale.grossProfit)}</td><td><span className={`source-badge ${sale.source.toLowerCase()}`}>{sale.source}</span></td><td><span className={`status-badge ${sale.status.toLowerCase()}`}>{sale.status === "COMPLETED" ? "Completed" : "Cancelled"}</span></td><td><button className="view-button" onClick={() => setSelectedSale(sale)}>View</button></td></tr>)}
			</tbody></table></div><div className="history-pagination"><label>Rows <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label><span>{sales.length ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, sales.length)} of ${sales.length}` : "0 sales"}</span><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></section>
	</div>
	{selectedSale && <div className="history-modal-backdrop" onMouseDown={() => setSelectedSale(null)}><div className="history-modal" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><div className="history-modal-heading"><div><h2>Sale #{selectedSale.id}</h2><p>{formatDate(selectedSale.createdAt, true)}</p></div><button className="history-close" onClick={() => setSelectedSale(null)}>×</button></div><div className="sale-meta"><span>Source <strong>{selectedSale.source}</strong></span><span>Status <strong>{selectedSale.status === "COMPLETED" ? "Completed" : "Cancelled"}</strong></span></div><table className="detail-sale-table"><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th></tr></thead><tbody>{selectedSale.items.map((item) => <tr key={item.id}><td><strong>{item.productName}</strong><small>Cost {money(item.costPrice)} / Profit {money(item.profit)}</small></td><td>{money(item.unitPrice)}</td><td>{item.quantity}</td><td>{money(item.subtotal)}</td></tr>)}</tbody></table><div className="sale-totals"><span>Total <strong>{money(selectedSale.totalAmount)}</strong></span><span>Cash Received <strong>{money(selectedSale.cashReceived)}</strong></span><span>Change <strong>{money(selectedSale.changeAmount)}</strong></span><span>Gross Profit <strong>{money(selectedSale.grossProfit)}</strong></span></div><div className="history-modal-actions">{selectedSale.status === "COMPLETED" && <button className="void-button" onClick={() => voidSale(selectedSale)}>Void Sale</button>}<button className="history-primary" onClick={() => setSelectedSale(null)}>Close</button></div></div></div>}
	</AppShell>;
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className={`history-summary-card ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
