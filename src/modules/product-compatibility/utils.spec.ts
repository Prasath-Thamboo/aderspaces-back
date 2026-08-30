import { describe, it, expect } from "vitest"
import { bidirectionalPairs, missingPairs, rowMatchesPair } from "./utils"

describe("bidirectionalPairs", () => {
  it("produit les deux sens", () => {
    expect(bidirectionalPairs("a", "b")).toEqual([
      { product_id: "a", compatible_product_id: "b" },
      { product_id: "b", compatible_product_id: "a" },
    ])
  })
})

describe("rowMatchesPair", () => {
  it("reconnaît la paire dans les deux sens", () => {
    expect(rowMatchesPair({ product_id: "a", compatible_product_id: "b" }, "a", "b")).toBe(true)
    expect(rowMatchesPair({ product_id: "b", compatible_product_id: "a" }, "a", "b")).toBe(true)
    expect(rowMatchesPair({ product_id: "a", compatible_product_id: "c" }, "a", "b")).toBe(false)
  })
})

describe("missingPairs", () => {
  it("renvoie les 2 lignes quand rien n'existe", () => {
    expect(missingPairs([], "a", "b")).toHaveLength(2)
  })

  it("renvoie la ligne manquante quand un seul sens existe", () => {
    const existing = [{ product_id: "a", compatible_product_id: "b" }]
    expect(missingPairs(existing, "a", "b")).toEqual([
      { product_id: "b", compatible_product_id: "a" },
    ])
  })

  it("renvoie [] quand le lien complet existe déjà (idempotence)", () => {
    const existing = [
      { product_id: "a", compatible_product_id: "b" },
      { product_id: "b", compatible_product_id: "a" },
    ]
    expect(missingPairs(existing, "a", "b")).toEqual([])
  })
})
