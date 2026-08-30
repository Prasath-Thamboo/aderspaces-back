import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_REVIEW_MODULE } from "../../../modules/product-review"

/** GET /admin/product-reviews?status=pending&product_id=prod_... — modération. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const reviewService: any = req.scope.resolve(PRODUCT_REVIEW_MODULE)

  const filters: Record<string, unknown> = {}
  if (req.query.status) filters.status = req.query.status
  if (req.query.product_id) filters.product_id = req.query.product_id

  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0

  const [reviews, count] = await reviewService.listAndCountProductReviews(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  })

  res.json({ product_reviews: reviews, count, limit, offset })
}
