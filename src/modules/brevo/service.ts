import { AbstractNotificationProviderService } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { BrevoClient } from "@getbrevo/brevo"

type BrevoOptions = {
  apiKey: string
  from: { email: string; name: string }
}

type Options = {
  logger?: Logger
  [key: string]: unknown
}

export class BrevoNotificationService extends AbstractNotificationProviderService {
  static identifier = "brevo"

  private client: BrevoClient
  private from: { email: string; name: string }
  private logger?: Logger

  constructor(options: Options, pluginOptions: BrevoOptions) {
    super()
    this.logger = options.logger as Logger | undefined
    this.from = pluginOptions.from ?? { email: "noreply@aderspace.fr", name: "Aderspace" }
    this.client = new BrevoClient({ apiKey: pluginOptions.apiKey })
    this.logger?.info("Brevo notification provider initialized")
  }

  async send(
    notification: { to: string; channel: string; template: string; data: Record<string, unknown> }
  ): Promise<{ id: string }> {
    const { to, template, data } = notification

    const templates: Record<string, { subject: string; html: string }> = {
      "order.placed": {
        subject: `Confirmation de commande #${data.order_id ?? ""}`,
        html: this.orderConfirmationHtml(data),
      },
      "contact": {
        subject: `Nouveau message de contact — ${data.name ?? ""}`,
        html: this.contactHtml(data),
      },
      "rgpd": {
        subject: `Demande RGPD — ${data.type ?? ""}`,
        html: this.rgpdHtml(data),
      },
      "customer.password_reset": {
        subject: "Réinitialisation de votre mot de passe Aderspace",
        html: this.passwordResetHtml(data),
      },
      "order.invoice": {
        subject: `Votre facture Aderspace ${data.invoice_number ?? ""}`,
        html: this.invoiceHtml(data),
      },
    }

    const tpl = templates[template]
    if (!tpl) {
      this.logger?.warn(`[Brevo] Template inconnu : ${template}`)
      return { id: "noop" }
    }

    const rawAttachments = Array.isArray(data.attachments) ? data.attachments : []
    const attachment = rawAttachments
      .map((a) => {
        const att = a as { name?: string; contentBase64?: string }
        return att?.name && att?.contentBase64
          ? { name: att.name, content: att.contentBase64 }
          : null
      })
      .filter((a): a is { name: string; content: string } => a !== null)

    try {
      const response = await this.client.transactionalEmails.sendTransacEmail({
        sender: { email: this.from.email, name: this.from.name },
        to: [{ email: to }],
        subject: tpl.subject,
        htmlContent: tpl.html,
        ...(attachment.length > 0 ? { attachment } : {}),
      })
      const messageId = (response as any)?.messageId ?? "sent"
      this.logger?.info(`[Brevo] Email envoyé à ${to} (${template})`)
      return { id: messageId }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.logger?.error(`[Brevo] Erreur envoi email : ${errMsg}`)
      throw err
    }
  }

  private orderConfirmationHtml(data: Record<string, unknown>): string {
    return `
      <h1 style="font-family:sans-serif">Merci pour votre commande !</h1>
      <p style="font-family:sans-serif">
        Bonjour ${data.customer_name ?? ""},<br>
        Votre commande <strong>#${data.order_id ?? ""}</strong> a bien été enregistrée.
      </p>
      <p style="font-family:sans-serif">Total : <strong>${data.total ?? ""}</strong></p>
      <p style="font-family:sans-serif">À bientôt,<br>L'équipe Aderspace</p>
    `
  }

  private contactHtml(data: Record<string, unknown>): string {
    return `
      <h2 style="font-family:sans-serif">Nouveau message de contact</h2>
      <p style="font-family:sans-serif"><strong>Nom :</strong> ${data.name ?? ""}</p>
      <p style="font-family:sans-serif"><strong>Email :</strong> ${data.email ?? ""}</p>
      <p style="font-family:sans-serif"><strong>Message :</strong><br>${String(data.message ?? "").replace(/\n/g, "<br>")}</p>
    `
  }

  private rgpdHtml(data: Record<string, unknown>): string {
    return `
      <h2 style="font-family:sans-serif">Demande RGPD</h2>
      <p style="font-family:sans-serif"><strong>Email :</strong> ${data.email ?? ""}</p>
      <p style="font-family:sans-serif"><strong>Type :</strong> ${data.type ?? ""}</p>
      <p style="font-family:sans-serif"><strong>Précisions :</strong> ${data.message ?? "Aucune"}</p>
    `
  }

  private invoiceHtml(data: Record<string, unknown>): string {
    return `
      <h1 style="font-family:sans-serif">Votre facture est disponible</h1>
      <p style="font-family:sans-serif">
        Bonjour,<br>
        La facture <strong>${data.invoice_number ?? ""}</strong> de votre commande
        <strong>#${data.order_id ?? ""}</strong> est jointe à cet email au format PDF.
      </p>
      <p style="font-family:sans-serif">
        Vous pouvez également la retrouver à tout moment dans votre espace client,
        rubrique « Mes commandes ».
      </p>
      <p style="font-family:sans-serif">L'équipe Aderspace</p>
    `
  }

  private passwordResetHtml(data: Record<string, unknown>): string {
    return `
      <h1 style="font-family:sans-serif">Réinitialisation de mot de passe</h1>
      <p style="font-family:sans-serif">
        Une demande de réinitialisation de mot de passe a été faite pour ${data.email ?? ""}.
        Ce lien expire dans 15 minutes.
      </p>
      <p style="font-family:sans-serif">
        <a href="${data.reset_url ?? ""}">Réinitialiser mon mot de passe</a>
      </p>
      <p style="font-family:sans-serif">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `
  }
}
