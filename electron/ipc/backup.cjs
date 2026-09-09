const { app, dialog, shell, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { getDatabasePath, getPrisma, disconnectPrisma } = require("../services/database.cjs");

function backupDirectory() {
  return path.join(app.getPath("documents"), "ToyStationeryPOS", "Backups");
}

function timestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function formatBackup(filePrefix = "backup") {
  return `${filePrefix}-${timestamp()}.db`;
}

function readableError(error, fallback) {
  if (error?.code === "ENOENT") return "The database or backup file could not be found.";
  if (error?.code === "EACCES" || error?.code === "EPERM") return "The backup folder or database is not accessible.";
  return error instanceof Error ? error.message : fallback;
}

async function ensureBackupDirectory() {
  const directory = backupDirectory();
  await fs.promises.mkdir(directory, { recursive: true });
  return directory;
}

async function databaseFileSize() {
  try { return (await fs.promises.stat(getDatabasePath())).size; } catch { return 0; }
}

async function checkpointDatabase() {
  try { await getPrisma().$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);"); } catch { /* SQLite may not use WAL. */ }
}

async function copyDatabase(targetPath, prefix = "backup") {
  const databasePath = getDatabasePath();
  const source = await fs.promises.stat(databasePath).catch(() => null);
  if (!source || source.size <= 0) throw new Error("The production database file was not found or is empty.");
  await checkpointDatabase();
  await fs.promises.copyFile(databasePath, targetPath);
  const info = await fs.promises.stat(targetPath);
  return { fileName: path.basename(targetPath), fullPath: targetPath, createdAt: new Date().toISOString(), size: info.size, prefix };
}

async function validateSqlite(filePath) {
  const info = await fs.promises.stat(filePath).catch(() => null);
  if (!info || info.size <= 0) return false;
  const handle = await fs.promises.open(filePath, "r");
  const header = Buffer.alloc(16);
  try { await handle.read(header, 0, 16, 0); } finally { await handle.close(); }
  if (header.toString("utf8") !== "SQLite format 3\u0000") return false;

  const client = new PrismaClient({ datasourceUrl: `file:${filePath.replace(/\\/g, "/")}` });
  try {
    const tables = await client.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Product', 'Sale', 'SaleItem');");
    return tables.length === 3;
  } catch { return false; }
  finally { await client.$disconnect(); }
}

async function history() {
  const directory = await ensureBackupDirectory();
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const backups = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".db")) continue;
    const fullPath = path.join(directory, entry.name);
    const info = await fs.promises.stat(fullPath);
    backups.push({ fileName: entry.name, fullPath, createdAt: info.mtime.toISOString(), size: info.size });
  }
  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
}

ipcMain.handle("backup:getStatus", async () => {
  const directory = await ensureBackupDirectory();
  const backups = await history();
  return {
    databaseName: path.basename(getDatabasePath()),
    databasePath: getDatabasePath(),
    databaseSize: await databaseFileSize(),
    backupDirectory: directory,
    lastBackup: backups[0]?.createdAt ?? null,
  };
});

ipcMain.handle("backup:create", async () => {
  try {
    const directory = await ensureBackupDirectory();
    return await copyDatabase(path.join(directory, formatBackup()));
  } catch (error) { throw new Error(readableError(error, "Unable to create database backup.")); }
});

ipcMain.handle("backup:getHistory", async () => {
  try { return await history(); } catch (error) { throw new Error(readableError(error, "Unable to read backup history.")); }
});

ipcMain.handle("backup:selectFile", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select SQLite Backup",
    properties: ["openFile"],
    filters: [{ name: "SQLite Backup", extensions: ["db"] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("backup:openFolder", async () => {
  const directory = await ensureBackupDirectory();
  const error = await shell.openPath(directory);
  if (error) throw new Error("Unable to open the backup folder.");
  return directory;
});

ipcMain.handle("backup:restore", async (_event, selectedPath) => {
  try {
    const sourcePath = path.resolve(String(selectedPath ?? ""));
    if (!(await validateSqlite(sourcePath))) throw new Error("The selected file is not a valid POS backup.");

    const directory = await ensureBackupDirectory();
    const safetyPath = path.join(directory, `pre-restore-${timestamp()}.db`);
    await copyDatabase(safetyPath, "pre-restore");
    await disconnectPrisma();
    await fs.promises.copyFile(sourcePath, getDatabasePath());

    app.relaunch();
    app.exit(0);
    return { success: true, restarting: true };
  } catch (error) {
    throw new Error(readableError(error, "Unable to restore the selected backup."));
  }
});

module.exports = { backupDirectory };
