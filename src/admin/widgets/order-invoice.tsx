import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types"
import { Container, Heading, Button, Text } from "@medusajs/ui"
import { DocumentText } from "@medusajs/icons"

const OrderInvoiceWidget = ({ data }: DetailWidgetProps<AdminOrder>) => {
  return (
    <Container className="flex items-center justify-between p-6">
      <div>
        <Heading level="h2">Facture</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Facture PDF conforme (numérotation FR-année-séquence).
        </Text>
      </div>
      <a
        href={`/admin/orders/${data.id}/invoice`}
        target="_blank"
        rel="noreferrer"
      >
        <Button variant="secondary" size="small">
          <DocumentText />
          Ouvrir la facture
        </Button>
      </a>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderInvoiceWidget
