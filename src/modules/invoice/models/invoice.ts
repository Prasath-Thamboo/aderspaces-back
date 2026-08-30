import { model } from "@medusajs/framework/utils"

/**
 * Facture émise pour une commande.
 * - `number` : séquentiel, chronologique, sans rupture (obligation FR),
 *   au format FR-<année>-<6 chiffres>.
 * - `snapshot` : instantané figé (vendeur, acheteur, lignes, totaux) au
 *   moment de l'émission — la facture ne doit plus changer ensuite.
 */
export const Invoice = model.define("invoice", {
  id: model.id().primaryKey(),
  number: model.text().unique(),
  sequence: model.number(),
  year: model.number(),
  order_id: model.text().unique(),
  display_id: model.number().nullable(),
  issued_at: model.dateTime(),
  currency_code: model.text(),
  subtotal: model.number().default(0),
  tax_total: model.number().default(0),
  total: model.number().default(0),
  customer_email: model.text(),
  snapshot: model.json(),
})
