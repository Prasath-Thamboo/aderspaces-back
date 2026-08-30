import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRODUCT_COMPATIBILITY_MODULE } from "../../../../../modules/product-compatibility"

/** GET /admin/products/:id/compatibility — produits liés (avec détails). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: any = req.scope.resolve(PRODUCT_COMPATIBILITY_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const ids = await service.listCompatibleIds(req.params.id)
  if (ids.length === 0) return res.json({ compatible_products: [] })

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "thumbnail", "status"],
    filters: { id: ids },
  })

  res.json({ compatible_products: products })
}

/** POST /admin/products/:id/compatibility  { compatible_product_id } */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const service: any = req.scope.resolve(PRODUCT_COMPATIBILITY_MODULE)
  const compatibleId = (req.body as { compatible_product_id?: string })
    ?.compatible_product_id

  if (!compatibleId) {
    return res.status(400).json({ message: "compatible_product_id est requis." })
  }
  if (compatibleId === req.params.id) {
    return res
      .status(400)
      .json({ message: "Un produit ne peut pas être compatible avec lui-même." })
  }

  await service.link(req.params.id, compatibleId)
  res.status(201).json({ product_id: req.params.id, compatible_product_id: compatibleId })
}

/** DELETE /admin/products/:id/compatibility?compatible_product_id=... */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const service: any = req.scope.resolve(PRODUCT_COMPATIBILITY_MODULE)
  const compatibleId = req.query.compatible_product_id as string | undefined

  if (!compatibleId) {
    return res.status(400).json({ message: "compatible_product_id est requis." })
  }

  await service.unlink(req.params.id, compatibleId)
  res.json({ product_id: req.params.id, compatible_product_id: compatibleId, deleted: true })
}
