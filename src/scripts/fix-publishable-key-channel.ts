import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { linkSalesChannelsToApiKeyWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Répare le cas "la clé publiable est liée à plusieurs canaux de vente" qui fait
 * échouer `POST /store/carts` avec :
 *   "The Publishable API Key in the header has multiple associated sales channels."
 *
 * On garde le lien vers "Boutique en ligne" et on retire tous les autres.
 *
 *   pnpm exec medusa exec ./src/scripts/fix-publishable-key-channel.ts
 */

const KEEP_CHANNEL_NAME = "Boutique en ligne"

export default async function fixPublishableKeyChannel({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)

  const [keep] = await salesChannelService.listSalesChannels({ name: KEEP_CHANNEL_NAME })
  if (!keep) {
    logger.error(`Canal "${KEEP_CHANNEL_NAME}" introuvable — lance d'abord "pnpm seed".`)
    return
  }

  const { data: keys } = await query.graph({
    entity: "api_key",
    fields: ["id", "title", "token", "type", "sales_channels.id", "sales_channels.name"],
  })

  const publishableKeys = keys.filter((k: any) => k.type === "publishable")
  if (publishableKeys.length === 0) {
    logger.error("Aucune clé publiable — lance d'abord \"pnpm seed\".")
    return
  }

  for (const key of publishableKeys) {
    const linked: { id: string; name: string }[] = key.sales_channels ?? []
    const toRemove = linked.filter((c) => c.id !== keep.id).map((c) => c.id)
    const hasKeep = linked.some((c) => c.id === keep.id)

    logger.info(
      `Clé "${key.title}" (${key.token}) : liée à [${linked.map((c) => c.name).join(", ") || "aucun"}]`
    )

    if (!hasKeep || toRemove.length > 0) {
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: {
          id: key.id,
          add: hasKeep ? [] : [keep.id],
          remove: toRemove,
        },
      })
      logger.info(
        `  -> corrigé : ${hasKeep ? "" : `+ ${KEEP_CHANNEL_NAME} ; `}${toRemove.length} lien(s) retiré(s). Seul "${KEEP_CHANNEL_NAME}" reste.`
      )
    } else {
      logger.info(`  -> déjà OK (uniquement "${KEEP_CHANNEL_NAME}").`)
    }
  }

  logger.info("fix-publishable-key-channel : terminé.")
}
