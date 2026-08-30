import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRODUCT_COMPATIBILITY_MODULE } from "../../../../../modules/product-compatibility"

/** GET /store/products/:id/compatible — produits compatibles publiés. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: any = req.scope.resolve(PRODUCT_COMPATIBILITY_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const ids: string[] = await service.listCompatibleIds(req.params.id)
  if (ids.length === 0) return res.json({ products: [] })

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "thumbnail",
      "status",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
    filters: { id: ids },
  })

  res.json({
    products: products
      .filter((p: any) => p.status === "published")
      .map((p: any) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        thumbnail: p.thumbnail,
        variants: (p.variants ?? []).map((v: any) => ({
          prices: (v.prices ?? []).map((pr: any) => ({
            amount: pr.amount,
            currency_code: pr.currency_code,
          })),
        })),
      })),
  })
}
