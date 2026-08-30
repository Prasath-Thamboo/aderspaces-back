import { Migration } from "@mikro-orm/migrations"

export class Migration20260830122000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "invoice" (
        "id" TEXT NOT NULL,
        "number" TEXT NOT NULL,
        "sequence" INTEGER NOT NULL,
        "year" INTEGER NOT NULL,
        "order_id" TEXT NOT NULL,
        "display_id" INTEGER NULL,
        "issued_at" TIMESTAMPTZ NOT NULL,
        "currency_code" TEXT NOT NULL,
        "subtotal" INTEGER NOT NULL DEFAULT 0,
        "tax_total" INTEGER NOT NULL DEFAULT 0,
        "total" INTEGER NOT NULL DEFAULT 0,
        "customer_email" TEXT NOT NULL,
        "snapshot" JSONB NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
      );
    `)
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_number_unique" ON "invoice" ("number") WHERE "deleted_at" IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_order_id_unique" ON "invoice" ("order_id") WHERE "deleted_at" IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_invoice_year" ON "invoice" ("year") WHERE "deleted_at" IS NULL;`
    )
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "invoice" CASCADE;`)
  }
}
