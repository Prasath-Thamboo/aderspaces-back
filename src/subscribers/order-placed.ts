import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

async function orderPlacedHandler({ event, container }: SubscriberArgs<{ id: string }>) {
  const notificationService = container.resolve(Modules.NOTIFICATION)
  const orderService = container.resolve(Modules.ORDER)

  const order = await orderService.retrieveOrder(event.data.id, {
    relations: ["items", "customer"],
  }).catch(() => null)

  if (!order) return

  const total = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: (order as any).currency_code?.toUpperCase() ?? "EUR",
  }).format(((order as any).total ?? 0) / 100)

  await notificationService.createNotifications({
    to: (order as any).email ?? (order as any).customer?.email ?? "",
    channel: "email",
    template: "order.placed",
    data: {
      order_id: order.id,
      customer_name: (order as any).customer?.first_name ?? "",
      total,
    },
  })
}

export default orderPlacedHandler

export const config: SubscriberConfig = {
  event: "order.placed",
}
