import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// Prix d'origine du seed (src/scripts/seed.ts), qui n'avaient jamais été
// réellement créés car productService.createProducts() ignore le champ
// `prices` (la tarification vit dans un module séparé et doit être liée
// explicitement). Script à usage unique pour rattraper les 12 produits
// déjà en base.
const VARIANT_PRICES: Record<string, { amount: number; currency_code: string }[]> = {
  "TAB-BAS-CHE-NAT": [{ amount: 29900, currency_code: "eur" }],
  "TAB-BAS-CHE-BLA": [{ amount: 32900, currency_code: "eur" }],
  "CAP-SCAN-3P-GRS": [{ amount: 79900, currency_code: "eur" }],
  "CAP-SCAN-3P-BGE": [{ amount: 79900, currency_code: "eur" }],
  "BIB-MOD-BLA": [{ amount: 44900, currency_code: "eur" }],
  "BIB-MOD-NOI": [{ amount: 44900, currency_code: "eur" }],
  "BIB-MOD-CHE": [{ amount: 47900, currency_code: "eur" }],
  "FAU-LOU-VEL-VRT": [{ amount: 34900, currency_code: "eur" }],
  "FAU-LOU-VEL-TER": [{ amount: 34900, currency_code: "eur" }],
  "FAU-LOU-VEL-BLE": [{ amount: 34900, currency_code: "eur" }],
  "HP-LJ-PRO-M404DN": [{ amount: 29900, currency_code: "eur" }],
  "EPS-ECOTANK-ET2850": [{ amount: 34900, currency_code: "eur" }],
  "CAN-PIXMA-TS8350A-NOI": [{ amount: 12900, currency_code: "eur" }],
  "CAN-PIXMA-TS8350A-BLA": [{ amount: 12900, currency_code: "eur" }],
  "BRO-HL-L3220CW": [{ amount: 24900, currency_code: "eur" }],
  "HP-305XL-NOI": [{ amount: 1999, currency_code: "eur" }],
  "HP-305XL-COL": [{ amount: 2199, currency_code: "eur" }],
  "EPS-ECOTANK-103-NOI": [{ amount: 1499, currency_code: "eur" }],
  "EPS-ECOTANK-103-PACK": [{ amount: 3999, currency_code: "eur" }],
}

export default async function backfillPrices({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const productService = container.resolve(Modules.PRODUCT)
  const pricingService = container.resolve(Modules.PRICING)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  const skus = Object.keys(VARIANT_PRICES)
  const variants = await productService.listProductVariants({ sku: skus })

  const linkService = remoteLink.getLinkModule(Modules.PRODUCT, "variant_id", Modules.PRICING, "price_set_id")
  if (!linkService) throw new Error("Module de lien variant <-> pricing introuvable.")
  const existingLinks = await linkService.list({ variant_id: variants.map((v: any) => v.id) }, { select: ["variant_id"] })
  const alreadyLinked = new Set(existingLinks.map((l: any) => l.variant_id))

  const toFix = variants.filter((v: any) => v.sku && VARIANT_PRICES[v.sku] && !alreadyLinked.has(v.id))

  if (toFix.length === 0) {
    logger.info("Rien à faire : toutes les variantes ciblées ont déjà un prix.")
    return
  }

  logger.info(`Création de ${toFix.length} price sets…`)
  const priceSets = await pricingService.createPriceSets(
    toFix.map((v: any) => ({ prices: VARIANT_PRICES[v.sku] }))
  )

  await remoteLink.create(
    toFix.map((v: any, i: number) => ({
      [Modules.PRODUCT]: { variant_id: v.id },
      [Modules.PRICING]: { price_set_id: priceSets[i].id },
    }))
  )

  logger.info(`✓ ${toFix.length} variante(s) mise(s) à jour avec un prix.`)
}
