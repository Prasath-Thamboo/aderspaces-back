import { model } from "@medusajs/framework/utils"

/**
 * Avis produit.
 * - Un seul avis par couple (produit, client) — contrainte d'unicité.
 * - `status` : tout avis naît `pending` et n'est affiché en boutique
 *   qu'une fois `approved` par un administrateur.
 * - `is_verified` : le client avait bien commandé le produit au moment
 *   du dépôt de l'avis (achat vérifié).
 */
export const ProductReview = model
  .define("product_review", {
    id: model.id().primaryKey(),
    product_id: model.text().index(),
    customer_id: model.text().index(),
    customer_name: model.text(),
    rating: model.number(),
    title: model.text(),
    content: model.text(),
    status: model
      .enum(["pending", "approved", "rejected"])
      .default("pending"),
    is_verified: model.boolean().default(false),
  })
  .indexes([
    {
      on: ["product_id", "customer_id"],
      unique: true,
    },
  ])
