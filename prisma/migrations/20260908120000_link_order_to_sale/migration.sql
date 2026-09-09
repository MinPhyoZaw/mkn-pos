-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'POS';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "saleId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Order_saleId_key" ON "Order"("saleId");

-- AddForeignKey
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "saleId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("id", "customerName", "phone", "address", "totalAmount", "paymentStatus", "status", "orderDate", "notes", "saleId", "createdAt", "updatedAt") SELECT "id", "customerName", "phone", "address", "totalAmount", "paymentStatus", "status", "orderDate", "notes", "saleId", "createdAt", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_saleId_key" ON "Order"("saleId");
PRAGMA foreign_keys=ON;