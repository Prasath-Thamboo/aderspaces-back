import { describe, it, expect } from "vitest"
import {
  formatInvoiceNumber,
  nextSequence,
  splitTaxInclusive,
  formatAddressLines,
  buildInvoiceSnapshot,
  sellerFromEnv,
  type SellerIdentity,
} from "./utils"

const seller: SellerIdentity = {
  name: "Aderspace SAS",
  address: "1 rue du Test, France",
  siren: "123456789",
  vat: "FR00123456789",
  rcs: "Paris",
  capital: "10 000 €",
  email: "contact@aderspace.fr",
  legalFooter: "Mentions.",
}

describe("formatInvoiceNumber", () => {
  it("formate FR-<année>-<6 chiffres>", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("FR-2026-000001")
    expect(formatInvoiceNumber(2026, 42)).toBe("FR-2026-000042")
    expect(formatInvoiceNumber(2027, 123456)).toBe("FR-2027-123456")
  })
})

describe("nextSequence", () => {
  it("incrémente le compteur annuel", () => {
    expect(nextSequence(0)).toBe(1)
    expect(nextSequence(99)).toBe(100)
  })
})

describe("splitTaxInclusive", () => {
  it("décompose un TTC en HT + TVA à 20 %", () => {
    const { ht, tva } = splitTaxInclusive(12000)
    expect(ht).toBe(10000)
    expect(tva).toBe(2000)
    expect(ht + tva).toBe(12000)
  })

  it("garantit HT + TVA === TTC même avec arrondi", () => {
    const { ht, tva } = splitTaxInclusive(9999)
    expect(ht + tva).toBe(9999)
  })
})

describe("formatAddressLines", () => {
  it("assemble et nettoie les lignes d'adresse", () => {
    expect(
      formatAddressLines({
        first_name: "Jean",
        last_name: "Dupont",
        address_1: "3 rue des Lilas",
        address_2: null,
        postal_code: "75011",
        city: "Paris",
        country_code: "fr",
      })
    ).toEqual(["Jean Dupont", "3 rue des Lilas", "75011 Paris", "FR"])
  })

  it("renvoie [] si adresse absente", () => {
    expect(formatAddressLines(null)).toEqual([])
  })
})

describe("buildInvoiceSnapshot", () => {
  const order = {
    id: "order_1",
    display_id: 1001,
    email: "jean@example.com",
    currency_code: "eur",
    created_at: "2026-08-30T09:00:00.000Z",
    total: 84000,
    tax_total: 14000,
    item_subtotal: 70000,
    items: [
      { product_title: "Bureau", variant_title: "Chêne", quantity: 2, unit_price: 30000, total: 60000 },
      { product_title: "Lampe", variant_title: null, quantity: 1, unit_price: 24000, total: 24000 },
    ],
    billing_address: {
      first_name: "Jean",
      last_name: "Dupont",
      address_1: "3 rue des Lilas",
      postal_code: "75011",
      city: "Paris",
      country_code: "fr",
    },
  }

  it("reprend les totaux fournis par la commande", () => {
    const s = buildInvoiceSnapshot(order, seller)
    expect(s.totals).toEqual({
      subtotal: 70000,
      tax_total: 14000,
      total: 84000,
      tax_note: "TVA 20 % incluse",
    })
    expect(s.order.date).toBe("2026-08-30")
    expect(s.order.display_id).toBe(1001)
  })

  it("étiquette les lignes et calcule le PU au centime près", () => {
    const s = buildInvoiceSnapshot(order, seller)
    expect(s.lines[0]).toEqual({
      label: "Bureau — Chêne",
      quantity: 2,
      unit_price: 30000,
      total: 60000,
    })
    expect(s.lines[1].label).toBe("Lampe")
  })

  it("ventile la TVA quand la commande ne la fournit pas", () => {
    const s = buildInvoiceSnapshot(
      { ...order, tax_total: 0, item_subtotal: 0, total: 12000, items: [] },
      seller
    )
    expect(s.totals.subtotal + s.totals.tax_total).toBe(12000)
    expect(s.totals.tax_total).toBe(2000)
  })
})

describe("sellerFromEnv", () => {
  it("lit les variables et retombe sur des placeholders", () => {
    const s = sellerFromEnv({ INVOICE_SELLER_NAME: "Ma Boîte" } as NodeJS.ProcessEnv)
    expect(s.name).toBe("Ma Boîte")
    expect(s.siren).toBe("[SIREN]")
  })
})
