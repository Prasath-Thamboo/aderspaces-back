/**
 * Helpers purs (sans dépendance Medusa) — testables unitairement.
 */

export type RatingLike = { rating: number }

/** Moyenne des notes, arrondie au dixième. 0 si aucune note. */
export function computeAverage(reviews: RatingLike[]): number {
  if (reviews.length === 0) return 0
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return Math.round((sum / reviews.length) * 10) / 10
}

/** Répartition du nombre d'avis par note (1→5). */
export function ratingBreakdown(reviews: RatingLike[]): Record<1 | 2 | 3 | 4 | 5, number> {
  const base = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>
  for (const r of reviews) {
    const k = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5
    base[k] += 1
  }
  return base
}

type OrderLike = { items?: ({ product_id?: string | null } | null)[] | null }

/** Le client a-t-il au moins une commande contenant ce produit ? */
export function hasPurchasedProduct(orders: OrderLike[], productId: string): boolean {
  return orders.some((o) =>
    (o.items ?? []).some((i) => i?.product_id === productId)
  )
}

export type ReviewInput = {
  rating?: unknown
  title?: unknown
  content?: unknown
}

/** Valide/normalise la charge utile d'un dépôt d'avis. */
export function normalizeReviewInput(input: ReviewInput):
  | { ok: true; value: { rating: number; title: string; content: string } }
  | { ok: false; error: string } {
  const rating = Number(input.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "La note doit être un entier de 1 à 5." }
  }
  const title = String(input.title ?? "").trim()
  if (title.length < 3 || title.length > 120) {
    return { ok: false, error: "Le titre doit faire entre 3 et 120 caractères." }
  }
  const content = String(input.content ?? "").trim()
  if (content.length < 10 || content.length > 4000) {
    return { ok: false, error: "L'avis doit faire entre 10 et 4000 caractères." }
  }
  return { ok: true, value: { rating, title, content } }
}
