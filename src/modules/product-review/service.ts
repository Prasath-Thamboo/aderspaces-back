import { MedusaService } from "@medusajs/framework/utils"
import { ProductReview } from "./models/product-review"
import { computeAverage, ratingBreakdown } from "./utils"

class ProductReviewModuleService extends MedusaService({ ProductReview }) {
  /** Statistiques publiques (avis approuvés uniquement) pour un produit. */
  async getProductStats(productId: string): Promise<{
    average: number
    count: number
    breakdown: Record<1 | 2 | 3 | 4 | 5, number>
  }> {
    const approved = await this.listProductReviews({
      product_id: productId,
      status: "approved",
    })
    return {
      average: computeAverage(approved),
      count: approved.length,
      breakdown: ratingBreakdown(approved),
    }
  }

  /** Stats pour plusieurs produits d'un coup (grille, listing). */
  async getStatsForProducts(
    productIds: string[]
  ): Promise<Record<string, { average: number; count: number }>> {
    if (productIds.length === 0) return {}
    const approved = await this.listProductReviews({
      product_id: productIds,
      status: "approved",
    })
    const byProduct: Record<string, typeof approved> = {}
    for (const r of approved) {
      ;(byProduct[r.product_id] ??= []).push(r)
    }
    const out: Record<string, { average: number; count: number }> = {}
    for (const id of productIds) {
      const list = byProduct[id] ?? []
      out[id] = { average: computeAverage(list), count: list.length }
    }
    return out
  }
}

export default ProductReviewModuleService
