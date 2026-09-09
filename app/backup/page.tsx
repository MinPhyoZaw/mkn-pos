"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import type { BackupHistoryItem, BackupStatus } from "@/types/electron";
import "./backup.css";

const getElectronApi = () => (typeof window !== "undefined" ? window.electron : undefined);
const formatBytes = (bytes: number) => {
	if (!bytes) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

export default function BackupPage() {
	const [status, setStatus] = useState<BackupStatus | null>(null);
	const [history, setHistory] = useState<BackupHistoryItem[]>([]);
	const [selectedPath, setSelectedPath] = useState("");
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");

	const load = async () => {
		setLoading(true); setError("");
		try {
			const api = getElectronApi();
			if (!api?.backup) throw new Error("Backup API is unavailable. Please restart the POS application.");
			const [nextStatus, nextHistory] = await Promise.all([api.backup.getStatus(), api.backup.getHistory()]);
			setStatus(nextStatus); setHistory(nextHistory);
		} catch (err) { setError(err instanceof Error ? err.message : "Unable to load backup status."); }
		finally { setLoading(false); }
	};
	useEffect(() => { load(); }, []);

	const createBackup = async () => {
		setWorking(true); setNotice(""); setError("");
		try {
			const api = getElectronApi();
			if (!api?.backup) throw new Error("Backup API is unavailable. Please restart the POS application.");
			await api.backup.create(); await load(); setNotice("Backup created successfully.");
		} catch (err) { setError(err instanceof Error ? err.message : "Unable to create backup."); }
		finally { setWorking(false); }
	};

	const selectBackup = async () => {
		setError("");
		try {
			const api = getElectronApi();
			if (!api?.backup) throw new Error("Backup API is unavailable. Please restart the POS application.");
			const selected = await api.backup.selectFile();
			if (selected) setSelectedPath(selected);
		} catch (err) { setError(err instanceof Error ? err.message : "Unable to select backup file."); }
	};

	const restore = async (backupPath: string) => {
		if (!backupPath || !window.confirm("Restore Backup?\n\nYour current POS data will be replaced by the selected backup.\n\nA safety backup will be created first. The POS will restart after restore.")) return;
		setWorking(true); setNotice(""); setError("");
		try {
			const api = getElectronApi();
			if (!api?.backup) throw new Error("Backup API is unavailable. Please restart the POS application.");
			await api.backup.restore(backupPath);
		} catch (err) { setError(err instanceof Error ? err.message : "Unable to restore backup."); setWorking(false); }
	};

	return <AppShell><div className="backup-page">
		<header className="backup-header"><div><h1>Backup / Restore</h1><p>Protect your offline POS data and restore it when needed.</p></div><button className="backup-primary" disabled={working || loading} onClick={createBackup}>Create Backup</button></header>
		{notice && <div className="backup-notice">{notice}</div>}{error && <div className="backup-error">{error}</div>}
		<section className="backup-status-card"><div className="backup-section-heading"><div><h2>Database Status</h2><p>Your production SQLite database is stored locally on this computer.</p></div></div><div className="backup-status-grid"><StatusItem label="Database" value={status?.databaseName ?? "Loading..."} /><StatusItem label="Last Backup" value={formatDate(status?.lastBackup ?? null)} /><StatusItem label="Backup Folder" value={status?.backupDirectory ?? "Loading..."} /><StatusItem label="Database Size" value={formatBytes(status?.databaseSize ?? 0)} /></div></section>
		<section className="backup-restore-card"><div><h2>Restore Backup</h2><p>Restore your POS data from a previous backup. A safety backup is created before replacement.</p></div><div className="backup-restore-controls"><button className="backup-secondary" onClick={selectBackup}>Select Backup File</button>{selectedPath && <div className="selected-backup"><span>Selected:</span><strong>{selectedPath.split(/[\\/]/).pop()}</strong><button className="backup-warning" disabled={working} onClick={() => restore(selectedPath)}>Restore Backup</button></div>}</div></section>
		<section className="backup-history-card"><div className="backup-section-heading"><div><h2>Recent Backups</h2><p>The latest 10 backups in your local backup folder.</p></div><button className="backup-secondary" onClick={() => getElectronApi()?.backup?.openFolder()}>Open Backup Folder</button></div>{!history.length ? <div className="backup-empty"><strong>No backups yet.</strong><span>Create your first backup to protect your POS data.</span></div> : <div className="backup-table-wrap"><table className="backup-table"><thead><tr><th>Date &amp; Time</th><th>File Name</th><th>Size</th><th>Actions</th></tr></thead><tbody>{history.map((item) => <tr key={item.fullPath}><td>{formatDate(item.createdAt)}</td><td><strong>{item.fileName}</strong></td><td>{formatBytes(item.size)}</td><td><button className="backup-warning" disabled={working} onClick={() => restore(item.fullPath)}>Restore</button></td></tr>)}</tbody></table></div>}</section>
	</div></AppShell>;
}

function StatusItem({ label, value }: { label: string; value: string }) { return <div className="backup-status-item"><span>{label}</span><strong title={value}>{value}</strong></div>; }
