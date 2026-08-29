import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// Script à usage unique : le seed (src/scripts/seed.ts) crée les produits via
// productService.createProducts(), qui ne crée ni article d'inventaire ni
// stock — contrairement au workflow standard createProductsWorkflow. Résultat :
// aucune variante n'a de stock, et l'ajout au panier échoue puisque
// manage_inventory=true et allow_backorder=false sur tous les produits.
// Ce script (1) lie l'entrepôt existant au canal de vente réellement utilisé
// par les produits, et (2) crée un article d'inventaire + un niveau de stock
// (50 unités) par variante.
const STOCK_PER_VARIANT = 50

export default async function backfillInventory({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const productService = container.resolve(Modules.PRODUCT)
  const inventoryService = container.resolve(Modules.INVENTORY)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  const locations = await stockLocationService.listStockLocations({ name: "Entrepôt principal" })
  const location = locations[0]
  if (!location) throw new Error("Entrepôt 'Entrepôt principal' introuvable — lancez le seed d'abord.")

  // Note : le lien entrepôt <-> canal de vente a été fait séparément via
  // POST /admin/stock-locations/:id/sales-channels (linkSalesChannelsToStockLocationWorkflow).

  // Variantes gérant l'inventaire sans article d'inventaire existant.
  const variants = await productService.listProductVariants({ manage_inventory: true } as any)
  const variantInventoryLink = remoteLink.getLinkModule(Modules.PRODUCT, "variant_id", Modules.INVENTORY, "inventory_item_id")
  if (!variantInventoryLink) throw new Error("Module de lien variant <-> inventory introuvable.")
  const existingVariantLinks = await variantInventoryLink.list({ variant_id: variants.map((v: any) => v.id) }, { select: ["variant_id"] })
  const alreadyLinked = new Set(existingVariantLinks.map((l: any) => l.variant_id))
  const toFix = variants.filter((v: any) => !alreadyLinked.has(v.id))

  if (toFix.length === 0) {
    logger.info("Rien à faire : toutes les variantes ont déjà un article d'inventaire.")
    return
  }

  logger.info(`Création de ${toFix.length} articles d'inventaire…`)
  const inventoryItems = await inventoryService.createInventoryItems(
    toFix.map((v: any) => ({ sku: v.sku, title: v.title }))
  )

  await remoteLink.create(
    toFix.map((v: any, i: number) => ({
      [Modules.PRODUCT]: { variant_id: v.id },
      [Modules.INVENTORY]: { inventory_item_id: inventoryItems[i].id },
    }))
  )

  await inventoryService.createInventoryLevels(
    inventoryItems.map((item: any) => ({
      inventory_item_id: item.id,
      location_id: location.id,
      stocked_quantity: STOCK_PER_VARIANT,
    }))
  )

  logger.info(`✓ ${toFix.length} variante(s) avec ${STOCK_PER_VARIANT} unités en stock à "${location.name}".`)
}
