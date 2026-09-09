"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import type { ReportSummaryData } from "@/types/electron";
import "./reports.css";

type Preset = "TODAY" | "LAST_7_DAYS" | "THIS_MONTH" | "ALL_TIME" | "CUSTOM";
const money = (value: number) => `${new Intl.NumberFormat("en-US").format(value)} ကျပ်`;
const getElectronApi = () => (typeof window !== "undefined" ? window.electron : undefined);
const todayInput = () => {
	const date = new Date();
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function ReportsPage() {
	const [preset, setPreset] = useState<Preset>("THIS_MONTH");
	const [startDate, setStartDate] = useState(todayInput());
	const [endDate, setEndDate] = useState(todayInput());
	const [report, setReport] = useState<ReportSummaryData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = async () => {
		setLoading(true); setError("");
		try {
			const api = getElectronApi();
			if (!api?.reports?.getSummary) throw new Error("Reports API is unavailable. Please restart the POS application.");
			if (preset === "CUSTOM" && (!startDate || !endDate)) throw new Error("Choose a start and end date.");
			setReport(await api.reports.getSummary({ preset, startDate, endDate }));
		} catch (err) { setError(err instanceof Error ? err.message : "Unable to load reports."); }
		finally { setLoading(false); }
	};
	useEffect(() => { load(); }, [preset, startDate, endDate]);

	return <AppShell><div className="reports-page">
		<header className="reports-header"><div><h1>Reports</h1><p>Analyze sales and business performance.</p></div><div className="reports-date-controls"><select value={preset} onChange={(event) => setPreset(event.target.value as Preset)}><option value="TODAY">Today</option><option value="LAST_7_DAYS">Last 7 Days</option><option value="THIS_MONTH">This Month</option><option value="ALL_TIME">All Time</option><option value="CUSTOM">Custom Range</option></select>{preset === "CUSTOM" && <><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></>}</div></header>
		{error && <div className="reports-error">{error}</div>}
		{loading && <div className="reports-loading">Loading report...</div>}
		{!loading && report && <>
			<section className="reports-summary"><ReportCard label="Total Sales" value={money(report.summary.totalSales)} tone="green" /><ReportCard label="Gross Profit" value={money(report.summary.grossProfit)} tone="blue" /><ReportCard label="Transactions" value={String(report.summary.transactions)} tone="violet" /><ReportCard label="Items Sold" value={String(report.summary.itemsSold)} tone="orange" /></section>
			<section className="report-panel trend-panel"><div className="report-heading"><div><h2>Sales Trend</h2><p>Completed sales by day in the selected period.</p></div></div>{!report.salesTrend.length ? <Empty text="No sales data for this period." /> : <SalesTrendChart data={report.salesTrend} />}</section>
			<div className="reports-grid"><section className="report-panel"><div className="report-heading"><div><h2>Top Selling Products</h2><p>Ranked by quantity sold.</p></div></div>{!report.topProducts.length ? <Empty text="No product sales in this period." /> : <ReportTable headers={["Product", "Qty Sold", "Revenue", "Profit"]} rows={report.topProducts.map((item) => [<strong key="name">{item.productName}</strong>, item.quantitySold, money(item.revenue), money(item.grossProfit)])} />}</section>
				<section className="report-panel source-panel"><div className="report-heading"><div><h2>Sales Source</h2><p>Completed revenue by source.</p></div></div>{!report.sourceBreakdown.length ? <Empty text="No sales source data available." /> : <SourceDonut data={report.sourceBreakdown} />}</section></div>
			<section className="report-panel"><div className="report-heading"><div><h2>Category Performance</h2><p>Revenue and stored profit grouped by current product category.</p></div></div>{!report.categoryPerformance.length ? <Empty text="No category sales in this period." /> : <ReportTable headers={["Category", "Qty Sold", "Revenue", "Profit"]} rows={report.categoryPerformance.map((item) => [<strong key="category">{item.categoryName}</strong>, item.quantitySold, money(item.revenue), money(item.grossProfit)])} />}</section>
			<div className="reports-secondary-grid"><section className="secondary-card"><span>Paid Orders</span><strong>{report.orderPaymentSummary.paidOrders}</strong></section><section className="secondary-card"><span>Unpaid Orders</span><strong>{report.orderPaymentSummary.unpaidOrders}</strong></section><section className="secondary-card"><span>Low Stock Items</span><strong>{report.stockSummary.lowStockItems}</strong></section><section className="secondary-card"><span>Out of Stock Items</span><strong>{report.stockSummary.outOfStockItems}</strong></section></div>
		</>}
	</div></AppShell>;
}

function ReportCard({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className={`report-card ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="report-empty">{text}</div>; }
function ReportTable({ headers, rows }: { headers: string[]; rows: Array<React.ReactNode[]> }) { return <div className="report-table-wrap"><table className="report-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>; }

function SalesTrendChart({ data }: { data: ReportSummaryData["salesTrend"] }) {
	const width = 760;
	const height = 260;
	const padding = { top: 18, right: 18, bottom: 42, left: 18 };
	const max = Math.max(...data.map((item) => item.total), 1);
	const points = data.map((item, index) => ({
		...item,
		x: data.length === 1 ? width / 2 : padding.left + (index * (width - padding.left - padding.right)) / (data.length - 1),
		y: height - padding.bottom - (item.total / max) * (height - padding.top - padding.bottom),
	}));
	const path = points.map((point, index) => {
		if (index === 0) return `M ${point.x} ${point.y}`;
		const previous = points[index - 1];
		const control = (previous.x + point.x) / 2;
		return `C ${control} ${previous.y}, ${control} ${point.y}, ${point.x} ${point.y}`;
	}).join(" ");

	return <div className="line-chart-wrap"><svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales trend line chart"><line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} className="chart-axis" /><path d={path} className="trend-line" fill="none" />{points.map((point) => <g key={point.date}><circle cx={point.x} cy={point.y} r="4" className="trend-point"><title>{`${point.label}\nSales: ${money(point.total)}`}</title></circle><text x={point.x} y={height - 12} textAnchor="middle" className="chart-label">{point.label}</text></g>)}</svg></div>;
}

function SourceDonut({ data }: { data: ReportSummaryData["sourceBreakdown"] }) {
	const total = data.reduce((sum, item) => sum + item.total, 0);
	let offset = 0;
	const segments = data.map((item) => {
		const percentage = total ? item.total / total : 0;
		const segment = { ...item, percentage, offset };
		offset += percentage;
		return segment;
	});
	const radius = 64;
	const circumference = 2 * Math.PI * radius;

	return <div className="donut-layout"><div className="donut-chart-wrap"><svg className="donut-chart" viewBox="0 0 180 180" role="img" aria-label="Sales source donut chart"><circle cx="90" cy="90" r={radius} className="donut-track" />{segments.map((item, index) => <circle key={item.source} cx="90" cy="90" r={radius} className={`donut-segment segment-${index}`} strokeDasharray={`${item.percentage * circumference} ${circumference}`} strokeDashoffset={-item.offset * circumference}><title>{`${item.source}: ${money(item.total)} (${Math.round(item.percentage * 100)}%)`}</title></circle>)}<text x="90" y="84" textAnchor="middle" className="donut-total-label">Total</text><text x="90" y="104" textAnchor="middle" className="donut-total-value">{money(total)}</text></svg></div><div className="donut-legend">{segments.map((item, index) => <div className="donut-legend-row" key={item.source}><span><i className={`legend-dot segment-${index}`} />{item.source}</span><strong>{money(item.total)} <small>{Math.round(item.percentage * 100)}%</small></strong></div>)}</div></div>;
}
