-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cost" DECIMAL(12,2),
    "price" DECIMAL(12,2),
    "initialStock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRecord" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "loggedById" TEXT,
    "pos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockEntry" (
    "id" TEXT NOT NULL,
    "dailyRecordId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "opening" INTEGER NOT NULL DEFAULT 0,
    "received" INTEGER NOT NULL DEFAULT 0,
    "closing" INTEGER NOT NULL DEFAULT 0,
    "transfer" INTEGER NOT NULL DEFAULT 0,
    "supply" INTEGER NOT NULL DEFAULT 0,
    "bd" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "dailyRecordId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRecord_date_key" ON "DailyRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StockEntry_dailyRecordId_productId_key" ON "StockEntry"("dailyRecordId", "productId");

-- AddForeignKey
ALTER TABLE "DailyRecord" ADD CONSTRAINT "DailyRecord_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_dailyRecordId_fkey" FOREIGN KEY ("dailyRecordId") REFERENCES "DailyRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_dailyRecordId_fkey" FOREIGN KEY ("dailyRecordId") REFERENCES "DailyRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
