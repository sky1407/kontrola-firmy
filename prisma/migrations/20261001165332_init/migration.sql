-- CreateTable
CREATE TABLE "company_snapshots" (
    "ico" CHAR(8) NOT NULL,
    "data" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_snapshots_pkey" PRIMARY KEY ("ico")
);
