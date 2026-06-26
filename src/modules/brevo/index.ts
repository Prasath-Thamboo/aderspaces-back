import { Module } from "@medusajs/framework/utils"
import { BrevoNotificationService } from "./service"

export default Module("brevo-notification", {
  service: BrevoNotificationService,
})
