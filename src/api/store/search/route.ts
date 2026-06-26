import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { meiliSearch, PRODUCTS_INDEX } from "../../../lib/meilisearch-client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = (req.query.q as string) || ""
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0

  if (!q.trim()) {
    return res.json({ hits: [], query: q, estimatedTotalHits: 0 })
  }

  try {
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
