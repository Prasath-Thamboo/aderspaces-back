import { MedusaService } from "@medusajs/framework/utils"
import { ProductCompatibility } from "./models/product-compatibility"
import { bidirectionalPairs, missingPairs, rowMatchesPair } from "./utils"

class ProductCompatibilityModuleService extends MedusaService({
  ProductCompatibility,
}) {
  /** IDs des produits déclarés compatibles avec `productId`. */
  async listCompatibleIds(productId: string): Promise<string[]> {
    const rows = await this.listProductCompatibilities({ product_id: productId })
    return rows.map((r: { compatible_product_id: string }) => r.compatible_product_id)
  }

  /** Crée le lien bidirectionnel A <-> B (idempotent). */
  async link(a: string, b: string): Promise<void> {
    if (a === b) {
      throw new Error("Un produit ne peut pas être compatible avec lui-même.")
    }
    const existing = await this.listProductCompatibilities({ product_id: [a, b] })
    const relevant = existing.filter((r: any) => rowMatchesPair(r, a, b))
    const toCreate = missingPairs(relevant, a, b)
    if (toCreate.length > 0) {
      await this.createProductCompatibilities(toCreate)
    }
  }

  /** Supprime le lien bidirectionnel A <-> B. */
  async unlink(a: string, b: string): Promise<void> {
    const existing = await this.listProductCompatibilities({ product_id: [a, b] })
    const ids = existing
      .filter((r: any) => rowMatchesPair(r, a, b))
      .map((r: { id: string }) => r.id)
    if (ids.length > 0) {
      await this.deleteProductCompatibilities(ids)
    }
  }

  /** Nettoie tous les liens (dans les 2 sens) référençant un produit supprimé. */
  async purgeProduct(productId: string): Promise<void> {
    const rows = await this.listProductCompatibilities({
      compatible_product_id: productId,
    })
    const own = await this.listProductCompatibilities({ product_id: productId })
    const ids = [...rows, ...own].map((r: { id: string }) => r.id)
    if (ids.length > 0) {
      await this.deleteProductCompatibilities([...new Set(ids)])
    }
  }

  /** Utilitaire exposé pour les tests / scripts. */
  pairsFor(a: string, b: string) {
    return bidirectionalPairs(a, b)
  }
}

export default ProductCompatibilityModuleService
