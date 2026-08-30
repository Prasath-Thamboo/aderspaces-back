/**
 * Helpers purs (sans dépendance Medusa ni pdfkit) — testables unitairement.
 */

/** Champs à charger via `query.graph({ entity: "order" })` pour bâtir une facture. */
export const INVOICE_ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "created_at",
  "total",
  "tax_total",
  "item_subtotal",
  "subtotal",
  "customer_id",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.quantity",
  "items.unit_price",
  "items.total",
  "billing_address.first_name",
  "billing_address.last_name",
  "billing_address.company",
  "billing_address.address_1",
  "billing_address.address_2",
  "billing_address.postal_code",
  "billing_address.city",
  "billing_address.province",
  "billing_address.country_code",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.company",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.postal_code",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.country_code",
] as const

export type SellerIdentity = {
  name: string
  address: string
  siren: string
  vat: string
  rcs: string
  capital: string
  email: string
  legalFooter: string
}

/** Numéro de facture séquentiel, chronologique, sans rupture : FR-2026-000001. */
export function formatInvoiceNumber(year: number, sequence: number): string {
  return `FR-${year}-${String(sequence).padStart(6, "0")}`
}

/** Prochaine valeur de séquence pour une année donnée. */
export function nextSequence(existingCountForYear: number): number {
  return existingCountForYear + 1
}

type OrderLineLike = {
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  quantity?: number | null
  unit_price?: number | null
  total?: number | null
}

type AddressLike = {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  postal_code?: string | null
  city?: string | null
  province?: string | null
  country_code?: string | null
}

type OrderLike = {
  id: string
  display_id?: number | null
  email?: string | null
  currency_code?: string | null
  created_at?: string | Date | null
  total?: number | null
  tax_total?: number | null
  item_subtotal?: number | null
  subtotal?: number | null
  items?: (OrderLineLike | null)[] | null
  billing_address?: AddressLike | null
  shipping_address?: AddressLike | null
}

export function formatAddressLines(addr?: AddressLike | null): string[] {
  if (!addr) return []
  const name = [addr.first_name, addr.last_name].filter(Boolean).join(" ")
  const lines = [
    name,
    addr.company,
    addr.address_1,
    addr.address_2,
    [addr.postal_code, addr.city].filter(Boolean).join(" "),
    addr.country_code ? addr.country_code.toUpperCase() : null,
  ]
  return lines.map((l) => (l ?? "").trim()).filter(Boolean)
}

/**
 * Décompose un total TTC en (HT, TVA) pour un taux donné (défaut 20 %).
 * Utilisé quand la commande ne fournit pas de ventilation de TVA.
 */
export function splitTaxInclusive(
  totalTtc: number,
  rate = 0.2
): { ht: number; tva: number } {
  const ht = Math.round(totalTtc / (1 + rate))
  return { ht, tva: totalTtc - ht }
}

export type InvoiceSnapshot = {
  seller: SellerIdentity
  buyer: { email: string; lines: string[] }
  order: {
    id: string
    display_id: number | null
    date: string // ISO date (jour)
    currency_code: string
  }
  lines: Array<{
    label: string
    quantity: number
    unit_price: number
    total: number
  }>
  totals: {
    subtotal: number
    tax_total: number
    total: number
    tax_note: string
  }
}

/** Construit l'instantané figé de la facture à partir d'une commande. */
export function buildInvoiceSnapshot(
  order: OrderLike,
  seller: SellerIdentity,
  vatRate = 0.2
): InvoiceSnapshot {
  const currency = (order.currency_code ?? "eur").toLowerCase()
  const rawDate = order.created_at ? new Date(order.created_at) : new Date()
  const date = rawDate.toISOString().slice(0, 10)

  const lines = (order.items ?? [])
    .filter((i): i is OrderLineLike => !!i)
    .map((i) => {
      const label =
        [i.product_title ?? i.title, i.variant_title]
          .filter(Boolean)
          .join(" — ") || "Article"
      const quantity = i.quantity ?? 1
      const total = i.total ?? (i.unit_price ?? 0) * quantity
      const unit_price = quantity ? Math.round(total / quantity) : total
      return { label, quantity, unit_price, total }
    })

  const total = order.total ?? lines.reduce((s, l) => s + l.total, 0)
  let subtotal = order.item_subtotal ?? order.subtotal ?? 0
  let tax_total = order.tax_total ?? 0
  if (!tax_total) {
    const split = splitTaxInclusive(total, vatRate)
    subtotal = split.ht
    tax_total = split.tva
  }

  return {
    seller,
    buyer: {
      email: order.email ?? "",
      lines: formatAddressLines(order.billing_address ?? order.shipping_address),
    },
    order: {
      id: order.id,
      display_id: order.display_id ?? null,
      date,
      currency_code: currency,
    },
    lines,
    totals: {
      subtotal,
      tax_total,
      total,
      tax_note: `TVA ${Math.round(vatRate * 100)} % incluse`,
    },
  }
}

export function sellerFromEnv(env: NodeJS.ProcessEnv = process.env): SellerIdentity {
  return {
    name: env.INVOICE_SELLER_NAME || "Aderspace SAS",
    address:
      env.INVOICE_SELLER_ADDRESS ||
      "[Adresse du siège social] — France",
    siren: env.INVOICE_SELLER_SIREN || "[SIREN]",
    vat: env.INVOICE_SELLER_VAT || "[N° TVA intracommunautaire]",
    rcs: env.INVOICE_SELLER_RCS || "[Ville du RCS]",
    capital: env.INVOICE_SELLER_CAPITAL || "[Capital social] €",
    email: env.INVOICE_SELLER_EMAIL || env.BREVO_FROM_EMAIL || "contact@aderspace.fr",
    legalFooter:
      env.INVOICE_LEGAL_FOOTER ||
      "Pas d'escompte pour paiement anticipé. En cas de retard de paiement, pénalités au taux de 3 fois le taux d'intérêt légal et indemnité forfaitaire de recouvrement de 40 €.",
  }
}
