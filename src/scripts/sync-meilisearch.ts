import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { meiliIndexDocuments, meiliUpdateSettings, PRODUCTS_INDEX } from "../lib/meilisearch-client"

export default async function syncMeiliSearch({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const productService = container.resolve(Modules.PRODUCT)

  logger.info("Synchronisation MeiliSearch en cours...")

  await meiliUpdateSettings(PRODUCTS_INDEX, {
    searchableAttributes: ["title", "description", "handle", "categories"],
    displayedAttributes: ["id", "title", "handle", "thumbnail", "categories", "metadata"],
    filterableAttributes: ["categories"],
  })

  const products = await productService.listProducts(
    {},
    { relations: ["categories"] }
  )

  const documents = products.map((p: any) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    handle: p.handle,
    thumbnail: p.thumbnail,
    categories: p.categories?.map((c: any) => c.name) ?? [],
    metadata: p.metadata,
  }))

  await meiliIndexDocuments(PRODUCTS_INDEX, documents)
  logger.info(`MeiliSearch : ${documents.length} produits indexés`)
}
