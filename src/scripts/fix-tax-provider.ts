import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * La région de taxe France a été créée par le seed sans `provider_id` :
 * l'ajout au panier plante alors dans le calcul de TVA avec
 *   "Unable to retrieve the tax provider with id: null".
 *
 * Ce script assigne le provider de taxe système (`tp_system`) à toutes les
 * régions de taxe qui n'en ont pas.
 *
 *   pnpm exec medusa exec ./src/scripts/fix-tax-provider.ts
 */
export default async function fixTaxProvider({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const taxService = container.resolve(Modules.TAX)

  const providers = await taxService.listTaxProviders()
  logger.info(`Providers de taxe disponibles : ${providers.map((p: any) => p.id).join(", ") || "aucun"}`)
  const systemProvider =
    providers.find((p: any) => p.id === "tp_system" || p.id.endsWith("_system")) ?? providers[0]
  if (!systemProvider) {
    logger.error("Aucun provider de taxe enregistré — vérifie medusa-config.ts.")
    return
  }

  const regions = await taxService.listTaxRegions({}, { select: ["id", "country_code", "province_code", "provider_id"] })
  const toFix = regions.filter((r: any) => !r.provider_id)

  if (toFix.length === 0) {
    logger.info("Toutes les régions de taxe ont déjà un provider — rien à faire.")
    return
  }

  for (const r of toFix) {
    await taxService.updateTaxRegions({
      selector: { id: r.id },
      data: { provider_id: systemProvider.id },
    } as any)
    logger.info(`  -> ${r.country_code ?? r.id} : provider_id = ${systemProvider.id}`)
  }

  logger.info(`fix-tax-provider : ${toFix.length} région(s) corrigée(s).`)
}
