import {
  MedusaRequest,
  MedusaResponse,
  AuthenticatedMedusaRequest,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PRODUCT_REVIEW_MODULE } from "../../../../../modules/product-review"
import {
  normalizeReviewInput,
  hasPurchasedProduct,
} from "../../../../../modules/product-review/utils"

const PAGE_SIZE = 10

/** GET /store/products/:id/reviews — avis approuvés + statistiques. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId = req.params.id
  const reviewService: any = req.scope.resolve(PRODUCT_REVIEW_MODULE)

  const limit = Math.min(Number(req.query.limit) || PAGE_SIZE, 50)
  const offset = Number(req.query.offset) || 0

  const [reviews, count] = await reviewService.listAndCountProductReviews(
    { product_id: productId, status: "approved" },
    { take: limit, skip: offset, order: { created_at: "DESC" } }
  )

  const stats = await reviewService.getProductStats(productId)

  res.json({
    reviews: reviews.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      content: r.content,
      customer_name: r.customer_name,
      is_verified: r.is_verified,
      created_at: r.created_at,
    })),
    count,
    limit,
    offset,
    stats,
  })
}

/** POST /store/products/:id/reviews — dépôt d'un avis (client connecté, achat vérifié). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const productId = req.params.id
  const customerId = req.auth_context?.actor_id

  if (!customerId || req.auth_context?.actor_type !== "customer") {
    return res.status(401).json({ message: "Vous devez être connecté pour laisser un avis." })
  }

  const parsed = normalizeReviewInput(req.body as Record<string, unknown>)
  if (!parsed.ok) {
    return res.status(400).json({ message: parsed.error })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const reviewService: any = req.scope.resolve(PRODUCT_REVIEW_MODULE)
  const customerService: any = req.scope.resolve(Modules.CUSTOMER)

  // Le produit existe-t-il ?
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "status"],
    filters: { id: productId },
  })
  if (!products.length || products[0].status !== "published") {
    return res.status(404).json({ message: "Produit introuvable." })
  }

  // Un seul avis par client et par produit.
  const existing = await reviewService.listProductReviews({
    product_id: productId,
    customer_id: customerId,
  })
  if (existing.length > 0) {
    return res.status(409).json({ message: "Vous avez déjà publié un avis sur ce produit." })
  }

  // Achat vérifié : au moins une commande du client contient ce produit.
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "items.product_id"],
    filters: { customer_id: customerId },
  })
  if (!hasPurchasedProduct(orders as any[], productId)) {
    return res.status(403).json({
      message:
        "Seuls les clients ayant commandé ce produit peuvent laisser un avis.",
    })
  }

  const customer = await customerService
    .retrieveCustomer(customerId)
    .catch(() => null)
  const displayName = customer
    ? `${customer.first_name ?? ""} ${(customer.last_name ?? "").slice(0, 1)}`.trim() ||
      "Client Aderspace"
    : "Client Aderspace"

  const [review] = await reviewService.createProductReviews([
    {
      product_id: productId,
      customer_id: customerId,
      customer_name: displayName,
      rating: parsed.value.rating,
      title: parsed.value.title,
      content: parsed.value.content,
      status: "pending",
      is_verified: true,
    },
  ])

  res.status(201).json({
    review: { id: review.id, status: review.status },
    message: "Merci ! Votre avis sera publié après validation par notre équipe.",
  })
}
