const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

let prisma;

/**
 * Returns the SQLite database actually used by the POS.
 *
 * Development:
 *   prisma/dev.db
 *
 * Production:
 *   C:\Users\<user>\AppData\Roaming\<app>\pos.db
 */
function getDatabasePath() {
  if (app.isPackaged) {
    return path.join(app.getPath("userData"), "pos.db");
  }

  const configured =
    process.env.DATABASE_URL || "file:./dev.db";

  if (!configured.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL must point to a SQLite file."
    );
  }

  const filePath = configured.slice("file:".length);

  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(
        __dirname,
        "../../prisma",
        filePath
      );
}

/**
 * Converts Windows path to Prisma SQLite URL.
 */
function databaseUrl() {
  const databasePath = getDatabasePath().replace(
    /\\/g,
    "/"
  );

  return `file:${databasePath}`;
}

/**
 * On the customer's first launch:
 *
 * packaged template.db
 *          ↓
 * AppData/.../pos.db
 *
 * Existing databases are NEVER overwritten here.
 */
function ensurePackagedDatabase() {
  if (!app.isPackaged) {
    return;
  }

  const databasePath = getDatabasePath();

  // Existing customer database must never be overwritten.
  if (fs.existsSync(databasePath)) {
    return;
  }

  const templatePath = path.join(
    app.getAppPath(),
    "prisma",
    "template.db"
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Production database template was not found: ${templatePath}`
    );
  }

  fs.mkdirSync(path.dirname(databasePath), {
    recursive: true,
  });

  fs.copyFileSync(
    templatePath,
    databasePath
  );

  console.log(
    `Production database created: ${databasePath}`
  );
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
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();
  prisma = undefined;
}

function resetPrisma() {
  prisma = undefined;
}

module.exports = {
  getDatabasePath,
  getPrisma,
  disconnectPrisma,
  resetPrisma,
};