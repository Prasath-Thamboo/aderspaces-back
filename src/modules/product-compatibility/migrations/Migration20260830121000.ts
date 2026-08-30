import { Migration } from "@mikro-orm/migrations"

export class Migration20260830121000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "product_compatibility" (
        "id" TEXT NOT NULL,
        "product_id" TEXT NOT NULL,
        "compatible_product_id" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "product_compatibility_pkey" PRIMARY KEY ("id")
      );
    `)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_compatibility_product_id" ON "product_compatibility" ("product_id") WHERE "deleted_at" IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_compatibility_compatible_product_id" ON "product_compatibility" ("compatible_product_id") WHERE "deleted_at" IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_compatibility_pair_unique" ON "product_compatibility" ("product_id", "compatible_product_id") WHERE "deleted_at" IS NULL;`
    )
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "product_compatibility" CASCADE;`)
  }
}
