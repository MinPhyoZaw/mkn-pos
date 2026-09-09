const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

let prisma;

function getDatabasePath() {
	if (app.isPackaged) return path.join(app.getPath("userData"), "pos.db");

	const configured = process.env.DATABASE_URL || "file:./dev.db";
	if (!configured.startsWith("file:")) throw new Error("DATABASE_URL must point to a SQLite file.");
	const filePath = configured.slice("file:".length);
	return path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, "../../prisma", filePath);
}

function databaseUrl() {
	return `file:${getDatabasePath().replace(/\\/g, "/")}`;
}

function ensurePackagedDatabase() {
	if (!app.isPackaged) return;
	const databasePath = getDatabasePath();
	if (fs.existsSync(databasePath)) return;

	const bundledPath = path.join(process.resourcesPath, "prisma", "dev.db");
	if (fs.existsSync(bundledPath)) {
		fs.mkdirSync(path.dirname(databasePath), { recursive: true });
		fs.copyFileSync(bundledPath, databasePath);
	}
}

function getPrisma() {
	if (!prisma) {
		ensurePackagedDatabase();
		process.env.DATABASE_URL = databaseUrl();
		prisma = new PrismaClient();
	}
	return prisma;
}

async function disconnectPrisma() {
	if (!prisma) return;
	await prisma.$disconnect();
	prisma = undefined;
}

function resetPrisma() {
	prisma = undefined;
}

module.exports = { getDatabasePath, getPrisma, disconnectPrisma, resetPrisma };
