import { model } from "@medusajs/framework/utils"

/**
 * Compatibilité entre deux produits, pilotable depuis l'admin.
 * La relation est stockée dans les DEUX sens (deux lignes) pour qu'une
 * recherche « produits compatibles avec X » soit un simple
 * `WHERE product_id = X`.
 */
export const ProductCompatibility = model
  .define("product_compatibility", {
    id: model.id().primaryKey(),
    product_id: model.text().index(),
    compatible_product_id: model.text().index(),
  })
  .indexes([
    {
      on: ["product_id", "compatible_product_id"],
      unique: true,
    },
  ])
