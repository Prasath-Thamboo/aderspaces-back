/**
 * Helpers purs (sans dépendance Medusa) — testables unitairement.
 */

export type CompatRow = { product_id: string; compatible_product_id: string }

/** Les deux lignes qui matérialisent un lien bidirectionnel A <-> B. */
export function bidirectionalPairs(a: string, b: string): CompatRow[] {
  return [
    { product_id: a, compatible_product_id: b },
    { product_id: b, compatible_product_id: a },
  ]
}

/** Une ligne existante concerne-t-elle la paire {a, b} (dans un sens ou l'autre) ? */
export function rowMatchesPair(row: CompatRow, a: string, b: string): boolean {
  return (
    (row.product_id === a && row.compatible_product_id === b) ||
    (row.product_id === b && row.compatible_product_id === a)
  )
}

/** Parmi les 2 lignes attendues pour {a,b}, celles qui manquent encore. */
export function missingPairs(existing: CompatRow[], a: string, b: string): CompatRow[] {
  const have = new Set(
    existing.map((r) => `${r.product_id}:${r.compatible_product_id}`)
  )
  return bidirectionalPairs(a, b).filter(
    (p) => !have.has(`${p.product_id}:${p.compatible_product_id}`)
  )
}
