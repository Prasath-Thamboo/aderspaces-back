import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { Container, Heading, Button, Input, Text, IconButton, toast } from "@medusajs/ui"
import { XMark } from "@medusajs/icons"
import { useEffect, useState, useCallback } from "react"

type MiniProduct = { id: string; title: string; handle: string; thumbnail?: string | null }

const ProductCompatibilityWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const [linked, setLinked] = useState<MiniProduct[]>([])
  const [term, setTerm] = useState("")
  const [results, setResults] = useState<MiniProduct[]>([])
  const [loading, setLoading] = useState(true)

  const loadLinked = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/admin/products/${data.id}/compatibility`, {
        credentials: "include",
      })
      const json = await res.json()
      setLinked(json.compatible_products ?? [])
    } catch {
      setLinked([])
    } finally {
      setLoading(false)
    }
  }, [data.id])

  useEffect(() => {
    loadLinked()
  }, [loadLinked])

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/admin/products?q=${encodeURIComponent(term)}&limit=8&fields=id,title,handle,thumbnail`,
        { credentials: "include" }
      )
      const json = await res.json()
      const linkedIds = new Set([data.id, ...linked.map((p) => p.id)])
      setResults((json.products ?? []).filter((p: MiniProduct) => !linkedIds.has(p.id)))
    }, 250)
    return () => clearTimeout(t)
  }, [term, linked, data.id])

  const add = async (compatibleId: string) => {
    const res = await fetch(`/admin/products/${data.id}/compatibility`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compatible_product_id: compatibleId }),
    })
    if (res.ok) {
      setTerm("")
      setResults([])
      loadLinked()
    } else {
      toast.error("Impossible d'ajouter ce lien")
    }
  }

  const remove = async (compatibleId: string) => {
    const res = await fetch(
      `/admin/products/${data.id}/compatibility?compatible_product_id=${compatibleId}`,
      { method: "DELETE", credentials: "include" }
    )
    if (res.ok) loadLinked()
    else toast.error("Impossible de retirer ce lien")
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Produits compatibles</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Lien réciproque : ajouté ici, il apparaît aussi sur l&apos;autre produit.
        </Text>
      </div>

      <div className="flex flex-col gap-2 px-6 py-4">
        {loading ? (
          <Text size="small" className="text-ui-fg-subtle">
            Chargement…
          </Text>
        ) : linked.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            Aucun produit compatible déclaré.
          </Text>
        ) : (
          linked.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <Text size="small">{p.title}</Text>
              <IconButton size="small" variant="transparent" onClick={() => remove(p.id)}>
                <XMark />
              </IconButton>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 px-6 py-4">
        <Input
          placeholder="Rechercher un produit à lier…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        {results.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2">
            <Text size="small">{p.title}</Text>
            <Button size="small" variant="secondary" onClick={() => add(p.id)}>
              Lier
            </Button>
          </div>
        ))}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductCompatibilityWidget
