import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

type PasswordResetEvent = {
  entity_id: string
  actor_type: string
  token: string
}

async function passwordResetHandler({ event, container }: SubscriberArgs<PasswordResetEvent>) {
  const { entity_id: email, actor_type, token } = event.data

  if (actor_type !== "customer") return

  const storefrontUrl = process.env.STOREFRONT_URL || "http://localhost:3000"
  const resetUrl = `${storefrontUrl}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

  try {
    const notificationService = container.resolve(Modules.NOTIFICATION)
    await notificationService.createNotifications({
      to: email,
      channel: "email",
      template: "customer.password_reset",
      data: { email, reset_url: resetUrl },
    })
  } catch {
    // Pas de fournisseur d'email configuré (BREVO_API_KEY absent) : on log le lien pour le dev.
    console.log(`[Réinitialisation mot de passe] ${email} → ${resetUrl}`)
  }
}

export default passwordResetHandler

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
