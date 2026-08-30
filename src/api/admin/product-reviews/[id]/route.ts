import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_REVIEW_MODULE } from "../../../../modules/product-review"

const ALLOWED = ["pending", "approved", "rejected"] as const

/** POST /admin/product-reviews/:id — change le statut de modération. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const reviewService: any = req.scope.resolve(PRODUCT_REVIEW_MODULE)
  const status = (req.body as { status?: string })?.status

  if (!status || !ALLOWED.includes(status as (typeof ALLOWED)[number])) {
    return res
      .status(400)
      .json({ message: `status doit être l'un de : ${ALLOWED.join(", ")}` })
  }

  const [review] = await reviewService.updateProductReviews([
    { id: req.params.id, status },
  ])

  res.json({ product_review: review })
}

/** DELETE /admin/product-reviews/:id — suppression définitive. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const reviewService: any = req.scope.resolve(PRODUCT_REVIEW_MODULE)
  await reviewService.deleteProductReviews(req.params.id)
  res.json({ id: req.params.id, object: "product_review", deleted: true })
}
