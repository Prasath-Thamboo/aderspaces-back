import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { meiliIndexDocuments, meiliDeleteDocument, PRODUCTS_INDEX } from "../lib/meilisearch-client"

async function syncProductToMeiliSearch({ event, container }: SubscriberArgs<{ id: string }>) {
  if (event.name === "product.deleted") {
    await meiliDeleteDocument(PRODUCTS_INDEX, event.data.id).catch(() => null)
    return
  }

  const productService = container.resolve(Modules.PRODUCT)

  const product = await productService.retrieveProduct(event.data.id, {
    relations: ["categories", "variants", "variants.prices"],
  }).catch(() => null)

  if (!product) return

  await meiliIndexDocuments(PRODUCTS_INDEX, [
    {
      id: product.id,
      title: product.title,
      description: product.description,
      handle: product.handle,
      thumbnail: product.thumbnail,
      categories: (product as any).categories?.map((c: any) => c.name) ?? [],
      metadata: product.metadata,
    },
  ])
}

export default syncProductToMeiliSearch

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated", "product.deleted"],
}
