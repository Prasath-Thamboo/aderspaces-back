import {
  MedusaResponse,
  AuthenticatedMedusaRequest,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { INVOICE_MODULE } from "../../../../../modules/invoice"
import { INVOICE_ORDER_FIELDS } from "../../../../../modules/invoice/utils"

/** GET /store/orders/:id/invoice — PDF de la facture (client propriétaire uniquement). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentification requise." })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const invoiceService: any = req.scope.resolve(INVOICE_MODULE)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [...INVOICE_ORDER_FIELDS],
    filters: { id: req.params.id },
  })
  const order = orders[0]

  if (!order || order.customer_id !== customerId) {
    return res.status(404).json({ message: "Commande introuvable." })
  }

  const invoice = await invoiceService.getOrCreateForOrder(order)
  const pdf: Buffer = await invoiceService.renderPdf(invoice)

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="facture-${invoice.number}.pdf"`
  )
  res.send(pdf)
}
