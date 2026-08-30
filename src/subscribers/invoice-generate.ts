import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { INVOICE_MODULE } from "../modules/invoice"
import { INVOICE_ORDER_FIELDS } from "../modules/invoice/utils"

const ORDER_FIELDS = INVOICE_ORDER_FIELDS as unknown as string[]

async function invoiceGenerateHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const invoiceService: any = container.resolve(INVOICE_MODULE)

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ORDER_FIELDS,
      filters: { id: event.data.id },
    })
    const order = orders[0]
    if (!order) return

    const invoice = await invoiceService.getOrCreateForOrder(order)
    logger.info(`[invoice] Facture ${invoice.number} émise pour la commande ${order.id}`)

    // Notification (envoyée seulement si Brevo est configuré).
    try {
      const notificationService = container.resolve(Modules.NOTIFICATION)
      const pdf: Buffer = await invoiceService.renderPdf(invoice)
      await notificationService.createNotifications({
        to: invoice.customer_email,
        channel: "email",
        template: "order.invoice",
        data: {
          invoice_number: invoice.number,
          order_id: order.display_id ?? order.id,
          attachments: [
            {
              name: `facture-${invoice.number}.pdf`,
              contentBase64: pdf.toString("base64"),
            },
          ],
        },
      })
    } catch (notifyErr) {
      logger.warn(
        `[invoice] Facture émise mais notification non envoyée : ${
          notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
        }`
      )
    }
  } catch (err) {
    logger.error(
      `[invoice] Échec de génération de la facture pour ${event.data.id} : ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }
}

export default invoiceGenerateHandler

export const config: SubscriberConfig = {
  event: "order.placed",
}
