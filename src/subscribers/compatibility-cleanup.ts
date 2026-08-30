import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRODUCT_COMPATIBILITY_MODULE } from "../modules/product-compatibility"

/** Retire les liens de compatibilité qui pointent vers un produit supprimé. */
async function compatibilityCleanupHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service: any = container.resolve(PRODUCT_COMPATIBILITY_MODULE)
  try {
    await service.purgeProduct(event.data.id)
  } catch (err) {
    logger.warn(
      `[compatibility] Nettoyage des liens échoué pour ${event.data.id} : ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }
}

export default compatibilityCleanupHandler

export const config: SubscriberConfig = {
  event: "product.deleted",
}
