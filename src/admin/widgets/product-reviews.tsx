import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { Container, Heading, Button, Badge, Text, toast } from "@medusajs/ui"
import { useEffect, useState, useCallback } from "react"

type Review = {
  id: string
  rating: number
  title: string
  content: string
  customer_name: string
  is_verified: boolean
  status: "pending" | "approved" | "rejected"
  created_at: string
}

const STATUS_COLOR = {
  pending: "orange",
  approved: "green",
  rejected: "red",
} as const

const ProductReviewsWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/admin/product-reviews?product_id=${data.id}&limit=100`,
        { credentials: "include" }
      )
      const json = await res.json()
      setReviews(json.product_reviews ?? [])
    } catch {
      setReviews([])
    } finally {
      setLoading(false)
    }
  }, [data.id])

  useEffect(() => {
    load()
  }, [load])

  const setStatus = async (id: string, status: Review["status"]) => {
    const res = await fetch(`/admin/product-reviews/${id}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(`Avis ${status === "approved" ? "publié" : "mis à jour"}`)
      load()
    } else {
      toast.error("Échec de la mise à jour")
    }
  }

  const remove = async (id: string) => {
    const res = await fetch(`/admin/product-reviews/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (res.ok) {
      toast.success("Avis supprimé")
      load()
    } else {
      toast.error("Échec de la suppression")
    }
  }

  const pending = reviews.filter((r) => r.status === "pending").length

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Avis clients</Heading>
        <div className="flex items-center gap-2">
          {pending > 0 && <Badge color="orange">{pending} en attente</Badge>}
          <Text size="small" className="text-ui-fg-subtle">
            {reviews.length} au total
          </Text>
        </div>
      </div>

      {loading ? (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Chargement…
          </Text>
        </div>
      ) : reviews.length === 0 ? (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Aucun avis pour ce produit.
          </Text>
        </div>
      ) : (
        reviews.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 px-6 py-4">
            <div className="flex items-center gap-2">
              <Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge>
              <Text weight="plus" size="small">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
              </Text>
              <Text size="small">{r.title}</Text>
              {r.is_verified && (
                <Badge color="blue" size="2xsmall">
                  achat vérifié
                </Badge>
              )}
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              {r.customer_name} · {new Date(r.created_at).toLocaleDateString("fr-FR")}
            </Text>
            <Text size="small">{r.content}</Text>
            <div className="flex gap-2 pt-1">
              {r.status !== "approved" && (
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setStatus(r.id, "approved")}
                >
                  Publier
                </Button>
              )}
              {r.status !== "rejected" && (
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setStatus(r.id, "rejected")}
                >
                  Rejeter
                </Button>
              )}
              <Button size="small" variant="danger" onClick={() => remove(r.id)}>
                Supprimer
              </Button>
            </div>
          </div>
        ))
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductReviewsWidget
