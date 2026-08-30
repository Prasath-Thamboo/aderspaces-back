import { describe, it, expect } from "vitest"
import {
  computeAverage,
  ratingBreakdown,
  hasPurchasedProduct,
  normalizeReviewInput,
} from "./utils"

describe("computeAverage", () => {
  it("moyenne arrondie au dixième", () => {
    expect(computeAverage([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toBe(4.3)
  })
  it("0 si aucun avis", () => {
    expect(computeAverage([])).toBe(0)
  })
})

describe("ratingBreakdown", () => {
  it("compte les avis par note", () => {
    const b = ratingBreakdown([{ rating: 5 }, { rating: 5 }, { rating: 3 }, { rating: 1 }])
    expect(b).toEqual({ 1: 1, 2: 0, 3: 1, 4: 0, 5: 2 })
  })
  it("borne les valeurs hors plage", () => {
    const b = ratingBreakdown([{ rating: 0 }, { rating: 9 }])
    expect(b[1]).toBe(1)
    expect(b[5]).toBe(1)
  })
})

describe("hasPurchasedProduct", () => {
  const orders = [
    { items: [{ product_id: "prod_A" }, { product_id: "prod_B" }] },
    { items: [{ product_id: "prod_C" }] },
  ]
  it("vrai si une commande contient le produit", () => {
    expect(hasPurchasedProduct(orders, "prod_B")).toBe(true)
  })
  it("faux sinon", () => {
    expect(hasPurchasedProduct(orders, "prod_Z")).toBe(false)
    expect(hasPurchasedProduct([], "prod_A")).toBe(false)
    expect(hasPurchasedProduct([{ items: null }], "prod_A")).toBe(false)
  })
})

describe("normalizeReviewInput", () => {
  it("accepte une charge valide", () => {
    const r = normalizeReviewInput({
      rating: "4",
      title: "Très bon bureau",
      content: "Solide et bien fini, montage rapide.",
    })
    expect(r).toEqual({
      ok: true,
      value: { rating: 4, title: "Très bon bureau", content: "Solide et bien fini, montage rapide." },
    })
  })

  it("refuse une note hors 1–5", () => {
    expect(normalizeReviewInput({ rating: 6, title: "abc", content: "0123456789" }).ok).toBe(false)
    expect(normalizeReviewInput({ rating: 2.5, title: "abc", content: "0123456789" }).ok).toBe(false)
  })

  it("refuse un titre trop court et un contenu trop court", () => {
    expect(normalizeReviewInput({ rating: 3, title: "ab", content: "0123456789" }).ok).toBe(false)
    expect(normalizeReviewInput({ rating: 3, title: "abc", content: "court" }).ok).toBe(false)
  })
})
