import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import { isMeiliEnabled, meiliSearch, PRODUCTS_INDEX } from "../../../lib/meilisearch-client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = (req.query.q as string) || ""
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0

  if (!q.trim()) {
    return res.json({ hits: [], query: q, estimatedTotalHits: 0 })
  }

  try {
    if (!isMeiliEnabled()) {
      // Repli sans Meili : recherche plein texte du module produit (Postgres).
      const productService = req.scope.resolve(Modules.PRODUCT)
      const [products, count] = await productService.listAndCountProducts(
        { q, status: ProductStatus.PUBLISHED },
        { take: limit, skip: offset, relations: ["categories"] }
      )
      return res.json({
        hits: products.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          handle: p.handle,
          thumbnail: p.thumbnail,
          categories: p.categories?.map((c) => c.name) ?? [],
          metadata: p.metadata,
        })),
        query: q,
        estimatedTotalHits: count,
      })
    }

    const result = await meiliSearch(PRODUCTS_INDEX, q, { limit, offset })
    return res.json({
      hits: result.hits,
      query: q,
      estimatedTotalHits: result.estimatedTotalHits,
    })
  } catch {
    return res.status(500).json({ message: "Erreur lors de la recherche" })
  }
}
