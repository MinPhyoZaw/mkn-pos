const { app, ipcMain } = require("electron");
const { getPrisma, getDatabasePath } = require("../services/database.cjs");
const { backupDirectory } = require("./backup.cjs");

const DEFAULT_SETTINGS = {
  shopName: "Toy and Stationery Shop",
  shopPhone: "",
  shopAddress: "",
  receiptFooter: "Thank you for shopping with us.",
  receiptShowShopName: true,
  receiptShowPhone: true,
  receiptShowAddress: true,
  receiptShowFooter: true,
  defaultLowStockLevel: 5,
  allowUnpaidOrderCompletion: true,
};

function parseSettings(rows) {
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    shopName: values.shopName ?? DEFAULT_SETTINGS.shopName,
    shopPhone: values.shopPhone ?? DEFAULT_SETTINGS.shopPhone,
    shopAddress: values.shopAddress ?? DEFAULT_SETTINGS.shopAddress,
    receiptFooter: values.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter,
    receiptShowShopName: values.receiptShowShopName !== undefined ? values.receiptShowShopName === "true" : DEFAULT_SETTINGS.receiptShowShopName,
    receiptShowPhone: values.receiptShowPhone !== undefined ? values.receiptShowPhone === "true" : DEFAULT_SETTINGS.receiptShowPhone,
    receiptShowAddress: values.receiptShowAddress !== undefined ? values.receiptShowAddress === "true" : DEFAULT_SETTINGS.receiptShowAddress,
    receiptShowFooter: values.receiptShowFooter !== undefined ? values.receiptShowFooter === "true" : DEFAULT_SETTINGS.receiptShowFooter,
    defaultLowStockLevel: values.defaultLowStockLevel === undefined ? DEFAULT_SETTINGS.defaultLowStockLevel : Math.max(0, Number(values.defaultLowStockLevel) || 0),
    allowUnpaidOrderCompletion: values.allowUnpaidOrderCompletion !== undefined ? values.allowUnpaidOrderCompletion === "true" : DEFAULT_SETTINGS.allowUnpaidOrderCompletion,
  };
}

async function readSettings(prisma = getPrisma()) {
  return parseSettings(await prisma.setting.findMany({ orderBy: { key: "asc" } }));
}

async function writeSettings(settings) {
  const normalized = {
    shopName: String(settings.shopName ?? "").trim(),
    shopPhone: String(settings.shopPhone ?? "").trim(),
    shopAddress: String(settings.shopAddress ?? "").trim(),
    receiptFooter: String(settings.receiptFooter ?? "").trim(),
    receiptShowShopName: Boolean(settings.receiptShowShopName),
    receiptShowPhone: Boolean(settings.receiptShowPhone),
    receiptShowAddress: Boolean(settings.receiptShowAddress),
    receiptShowFooter: Boolean(settings.receiptShowFooter),
    defaultLowStockLevel: Number(settings.defaultLowStockLevel),
    allowUnpaidOrderCompletion: Boolean(settings.allowUnpaidOrderCompletion),
  };
  if (!normalized.shopName) throw new Error("Shop name cannot be empty.");
  if (!Number.isInteger(normalized.defaultLowStockLevel) || normalized.defaultLowStockLevel < 0) throw new Error("Default low stock alert must be a non-negative whole number.");

  return getPrisma().$transaction(async (tx) => {
    for (const [key, value] of Object.entries(normalized)) {
      await tx.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
    }
    return parseSettings(await tx.setting.findMany());
  });
}

ipcMain.handle("settings:getAll", () => readSettings());
ipcMain.handle("settings:update", (_event, settings) => writeSettings(settings));
ipcMain.handle("settings:getSystemInfo", async () => ({
  appVersion: app.getVersion(),
  databaseName: require("path").basename(getDatabasePath()),
  databasePath: getDatabasePath(),
  backupPath: backupDirectory(),
}));

module.exports = { DEFAULT_SETTINGS, readSettings, writeSettings };
