import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { INVOICE_MODULE } from "../../../../../modules/invoice"
import { INVOICE_ORDER_FIELDS } from "../../../../../modules/invoice/utils"

/** GET /admin/orders/:id/invoice — PDF de la facture (admin). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const invoiceService: any = req.scope.resolve(INVOICE_MODULE)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [...INVOICE_ORDER_FIELDS],
    filters: { id: req.params.id },
  })
  const order = orders[0]
  if (!order) {
    return res.status(404).json({ message: "Commande introuvable." })
  }

  const invoice = await invoiceService.getOrCreateForOrder(order)
  const pdf: Buffer = await invoiceService.renderPdf(invoice)

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader(
    "Content-Disposition",
    `inline; filename="facture-${invoice.number}.pdf"`
  )
  res.send(pdf)
}
