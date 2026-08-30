import { MedusaService } from "@medusajs/framework/utils"
import PDFDocument from "pdfkit"
import { Invoice } from "./models/invoice"
import {
  buildInvoiceSnapshot,
  formatInvoiceNumber,
  nextSequence,
  sellerFromEnv,
  type InvoiceSnapshot,
} from "./utils"

type OrderLikeInput = Parameters<typeof buildInvoiceSnapshot>[0]

class InvoiceModuleService extends MedusaService({ Invoice }) {
  /** Récupère (ou crée si absente) la facture d'une commande. Idempotent. */
  async getOrCreateForOrder(order: OrderLikeInput): Promise<any> {
    const existing = await this.listInvoices({ order_id: order.id })
    if (existing.length > 0) return existing[0]
    return this.createForOrder(order)
  }

  async createForOrder(order: OrderLikeInput): Promise<any> {
    const seller = sellerFromEnv()
    const snapshot = buildInvoiceSnapshot(order, seller)
    const year = Number(snapshot.order.date.slice(0, 4))

    let lastErr: unknown
    for (let attempt = 0; attempt < 5; attempt++) {
      const countForYear = await this.listAndCountInvoices({ year }).then(
        ([, c]) => c
      )
      const sequence = nextSequence(countForYear)
      const number = formatInvoiceNumber(year, sequence)
      try {
        const [invoice] = await this.createInvoices([
          {
            number,
            sequence,
            year,
            order_id: order.id,
            display_id: snapshot.order.display_id,
            issued_at: new Date(),
            currency_code: snapshot.order.currency_code,
            subtotal: snapshot.totals.subtotal,
            tax_total: snapshot.totals.tax_total,
            total: snapshot.totals.total,
            customer_email: snapshot.buyer.email,
            snapshot,
          },
        ])
        return invoice
      } catch (err: any) {
        lastErr = err
        // Collision de numéro (course entre deux commandes) OU commande déjà facturée.
        const alreadyBilled = await this.listInvoices({ order_id: order.id })
        if (alreadyBilled.length > 0) return alreadyBilled[0]
        if (!String(err?.message ?? "").match(/unique|duplicate/i)) throw err
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error("Échec de la création de la facture (numérotation).")
  }

  /** Rendu PDF déterministe depuis l'instantané figé. */
  async renderPdf(invoiceOrId: string | { snapshot: InvoiceSnapshot; number: string }): Promise<Buffer> {
    const invoice =
      typeof invoiceOrId === "string"
        ? await this.retrieveInvoice(invoiceOrId)
        : invoiceOrId
    const snapshot = invoice.snapshot as InvoiceSnapshot
    return renderInvoicePdf(invoice.number, snapshot)
  }
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100)

function renderInvoicePdf(number: string, s: InvoiceSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 })
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const cur = s.order.currency_code

    // ── En-tête vendeur ──
    doc.fontSize(16).text(s.seller.name, { continued: false })
    doc.moveDown(0.2)
    doc.fontSize(9).fillColor("#555")
    doc.text(s.seller.address)
    doc.text(
      `SIREN ${s.seller.siren} · RCS ${s.seller.rcs} · Capital ${s.seller.capital}`
    )
    doc.text(`TVA ${s.seller.vat} · ${s.seller.email}`)
    doc.fillColor("#000")

    // ── Titre facture ──
    doc.moveDown(1.5)
    doc.fontSize(20).text("FACTURE", { align: "right" })
    doc.fontSize(10).fillColor("#555")
    doc.text(`N° ${number}`, { align: "right" })
    doc.text(`Date d'émission : ${frDate(s.order.date)}`, { align: "right" })
    if (s.order.display_id != null) {
      doc.text(`Commande n° ${s.order.display_id}`, { align: "right" })
    }
    doc.text(`Date de la vente : ${frDate(s.order.date)}`, { align: "right" })
    doc.fillColor("#000")

    // ── Bloc acheteur ──
    doc.moveDown(2)
    doc.fontSize(10).text("Facturé à", { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(10)
    if (s.buyer.lines.length === 0) doc.text(s.buyer.email)
    for (const line of s.buyer.lines) doc.text(line)
    if (s.buyer.lines.length > 0 && s.buyer.email) {
      doc.fillColor("#555").text(s.buyer.email).fillColor("#000")
    }

    // ── Tableau des lignes ──
    doc.moveDown(1.5)
    const top = doc.y
    const cols = { label: 50, qty: 320, unit: 380, total: 470 }
    doc.fontSize(9).fillColor("#555")
    doc.text("Désignation", cols.label, top)
    doc.text("Qté", cols.qty, top)
    doc.text("P.U. TTC", cols.unit, top)
    doc.text("Total TTC", cols.total, top)
    doc.moveTo(50, top + 14).lineTo(545, top + 14).strokeColor("#ccc").stroke()
    doc.fillColor("#000").fontSize(10)

    let y = top + 22
    for (const line of s.lines) {
      const h = doc.heightOfString(line.label, { width: 260 })
      doc.text(line.label, cols.label, y, { width: 260 })
      doc.text(String(line.quantity), cols.qty, y)
      doc.text(money(line.unit_price, cur), cols.unit, y)
      doc.text(money(line.total, cur), cols.total, y)
      y += Math.max(h, 14) + 8
      if (y > 720) {
        doc.addPage()
        y = 50
      }
    }

    doc.moveTo(50, y).lineTo(545, y).strokeColor("#ccc").stroke()
    y += 12

    // ── Totaux ──
    const putTotal = (label: string, value: string, bold = false) => {
      doc.fontSize(bold ? 12 : 10).fillColor(bold ? "#000" : "#333")
      doc.text(label, 320, y)
      doc.text(value, cols.total, y)
      y += bold ? 20 : 16
    }
    putTotal("Total HT", money(s.totals.subtotal, cur))
    putTotal("TVA (20 %)", money(s.totals.tax_total, cur))
    putTotal("Total TTC", money(s.totals.total, cur), true)
    doc.fillColor("#000")

    // ── Pied de page légal ──
    doc.moveDown(2)
    doc.fontSize(8).fillColor("#666")
    doc.text(s.totals.tax_note, 50, doc.y, { width: 495 })
    doc.moveDown(0.4)
    doc.text(s.seller.legalFooter, { width: 495 })

    doc.end()
  })
}

const frDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(iso))

export default InvoiceModuleService
